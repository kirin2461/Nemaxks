package nsp

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"testing"
)

// TestRoundTripAllTypes: encode→decode round-trip для всех типов фреймов §3.5.
func TestRoundTripAllTypes(t *testing.T) {
	types := []byte{
		TypeHELLO, TypeAUTH, TypeAUTHOK, TypeOPS, TypeOPSBCAST, TypeACK,
		TypeCURSOR, TypeSTATEREQ, TypeSTATE, TypeEVENT, TypePING, TypePONG,
		TypeERROR, TypeCLOSE, TypeSUBSCRIBE,
	}
	for _, typ := range types {
		payload := []byte(`{"type":` + string(rune('0'+typ)) + `,"data":"test"}`)
		enc, err := Encode(BootstrapPrefix, typ, 0, payload)
		if err != nil {
			t.Fatalf("type %#x encode: %v", typ, err)
		}
		dec := NewDecoder(BootstrapPrefix)
		dec.Feed(enc)
		f, err := dec.Next()
		if err != nil {
			t.Fatalf("type %#x decode: %v", typ, err)
		}
		if f == nil {
			t.Fatalf("type %#x: frame not decoded", typ)
		}
		if f.Type != typ || !bytes.Equal(f.Payload, payload) || f.Prefix != BootstrapPrefix {
			t.Fatalf("type %#x: round-trip mismatch", typ)
		}
	}
}

// TestRoundTripEmptyPayload: пустой payload допустим.
func TestRoundTripEmptyPayload(t *testing.T) {
	enc := MustEncode(BootstrapPrefix, TypePING, 0, nil)
	dec := NewDecoder(BootstrapPrefix)
	dec.Feed(enc)
	f, err := dec.Next()
	if err != nil || f == nil {
		t.Fatalf("decode empty payload: f=%v err=%v", f, err)
	}
	if len(f.Payload) != 0 {
		t.Fatalf("expected empty payload, got %d bytes", len(f.Payload))
	}
}

// TestSessionPrefix: session-фреймы с префиксом FA 5A + tail.
func TestSessionPrefix(t *testing.T) {
	p := SessionPrefix(0xAB, 0xCD)
	if p != [4]byte{0xFA, 0x5A, 0xAB, 0xCD} {
		t.Fatalf("bad session prefix: %x", p)
	}
	payload := []byte(`{"ok":1}`)
	enc := MustEncode(p, TypeOPSBCAST, FlagNeedAck, payload)
	dec := NewDecoder(p)
	dec.Feed(enc)
	f, err := dec.Next()
	if err != nil || f == nil {
		t.Fatalf("decode session frame: f=%v err=%v", f, err)
	}
	if f.Flags != FlagNeedAck || !bytes.Equal(f.Payload, payload) {
		t.Fatal("session frame mismatch")
	}
	// Тот же фрейм для декодера с bootstrap-префиксом — отброс.
	decB := NewDecoder(BootstrapPrefix)
	decB.Feed(enc)
	if _, err := decB.Next(); err != ErrBadPrefix {
		t.Fatalf("expected ErrBadPrefix, got %v", err)
	}
}

// TestTruncatedFrame: обрыв фрейма посередине — декодер ждёт дочитки.
func TestTruncatedFrame(t *testing.T) {
	payload := bytes.Repeat([]byte("x"), 500)
	enc := MustEncode(BootstrapPrefix, TypeSTATE, 0, payload)

	dec := NewDecoder(BootstrapPrefix)
	// Кормим по кускам: сначала половину — фрейма нет, ошибки нет.
	dec.Feed(enc[:250])
	f, err := dec.Next()
	if err != nil || f != nil {
		t.Fatalf("half frame: expected (nil,nil), got f=%v err=%v", f, err)
	}
	// Обрыв прямо посередине varint/заголовка (7 байт — минимум)
	dec2 := NewDecoder(BootstrapPrefix)
	dec2.Feed(enc[:6])
	if f, err := dec2.Next(); f != nil || err != nil {
		t.Fatalf("header-only: expected (nil,nil), got f=%v err=%v", f, err)
	}
	// Дочитка: фрейм собирается целиком.
	dec.Feed(enc[250:])
	f, err = dec.Next()
	if err != nil || f == nil {
		t.Fatalf("after refill: f=%v err=%v", f, err)
	}
	if !bytes.Equal(f.Payload, payload) {
		t.Fatal("payload mismatch after refill")
	}
}

// TestGarbagePrefix: мусор/невалидный prefix отбрасывается, декодер жив.
func TestGarbagePrefix(t *testing.T) {
	garbage := []byte{0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88}
	valid := MustEncode(BootstrapPrefix, TypePING, 0, []byte(`{"ts":1}`))

	dec := NewDecoder(BootstrapPrefix)
	dec.Feed(append(garbage, valid...))
	if _, err := dec.Next(); err != ErrBadPrefix {
		t.Fatalf("expected ErrBadPrefix, got %v", err)
	}
	f, err := dec.Next()
	if err != nil || f == nil {
		t.Fatalf("after garbage: f=%v err=%v", f, err)
	}
	if f.Type != TypePING {
		t.Fatalf("expected PING, got %#x", f.Type)
	}
}

// TestOversizeLengthRejectedBeforeAlloc: length > 65536 отбрасывается
// до выделения буфера (проверяем, что декодер не ждёт 1МБ дочитки).
func TestOversizeLengthRejectedBeforeAlloc(t *testing.T) {
	var hdr []byte
	hdr = append(hdr, BootstrapPrefix[:]...)
	hdr = append(hdr, TypeSTATE, 0)
	hdr = binary.AppendUvarint(hdr, MaxFrameSize+1) // 65537

	dec := NewDecoder(BootstrapPrefix)
	dec.Feed(hdr) // только заголовок, payload нет вообще
	if _, err := dec.Next(); err != ErrFrameTooLarge {
		t.Fatalf("expected ErrFrameTooLarge, got %v", err)
	}

	// Ровно 65536 — валидно.
	payload := bytes.Repeat([]byte("y"), MaxFrameSize)
	enc := MustEncode(BootstrapPrefix, TypeSTATE, 0, payload)
	dec2 := NewDecoder(BootstrapPrefix)
	dec2.Feed(enc)
	f, err := dec2.Next()
	if err != nil || f == nil {
		t.Fatalf("max-size frame: f=%v err=%v", f, err)
	}
	if len(f.Payload) != MaxFrameSize {
		t.Fatalf("expected %d payload, got %d", MaxFrameSize, len(f.Payload))
	}

	// Encode сверх лимита отклоняет.
	if _, err := Encode(BootstrapPrefix, TypeSTATE, 0, make([]byte, MaxFrameSize+1)); err != ErrFrameTooLarge {
		t.Fatalf("encode oversize: expected ErrFrameTooLarge, got %v", err)
	}
}

// TestMultipleFramesInOneBuffer: несколько фреймов в одном чтении.
func TestMultipleFramesInOneBuffer(t *testing.T) {
	var stream []byte
	payloads := [][]byte{
		[]byte(`{"protocol":2}`),
		[]byte(`{"jwt":"abc"}`),
		bytes.Repeat([]byte("z"), 1000),
	}
	types := []byte{TypeHELLO, TypeAUTH, TypeOPS}
	for i, p := range payloads {
		stream = append(stream, MustEncode(BootstrapPrefix, types[i], 0, p)...)
	}

	dec := NewDecoder(BootstrapPrefix)
	dec.Feed(stream)
	for i := range payloads {
		f, err := dec.Next()
		if err != nil || f == nil {
			t.Fatalf("frame %d: f=%v err=%v", i, f, err)
		}
		if f.Type != types[i] || !bytes.Equal(f.Payload, payloads[i]) {
			t.Fatalf("frame %d mismatch", i)
		}
	}
	// Больше фреймов нет.
	if f, err := dec.Next(); f != nil || err != nil {
		t.Fatalf("expected stream end, got f=%v err=%v", f, err)
	}
}

// TestCRCMismatch: битый crc → фрейм отброшен, поток продолжается.
func TestCRCMismatch(t *testing.T) {
	bad := MustEncode(BootstrapPrefix, TypeOPS, 0, []byte(`{"a":1}`))
	bad[len(bad)-1] ^= 0xFF // ломаем crc
	good := MustEncode(BootstrapPrefix, TypePING, 0, []byte(`{"ts":2}`))

	dec := NewDecoder(BootstrapPrefix)
	dec.Feed(append(bad, good...))
	if _, err := dec.Next(); err != ErrCRCMismatch {
		t.Fatalf("expected ErrCRCMismatch, got %v", err)
	}
	f, err := dec.Next()
	if err != nil || f == nil {
		t.Fatalf("after crc error: f=%v err=%v", f, err)
	}
	if f.Type != TypePING {
		t.Fatalf("expected PING after crc error, got %#x", f.Type)
	}
}

// TestCRCVectors: crc32 IEEE LE от payload — сверка с эталоном.
func TestCRCVectors(t *testing.T) {
	payload := []byte("123456789")
	enc := MustEncode(BootstrapPrefix, TypePING, 0, payload)
	got := binary.LittleEndian.Uint32(enc[len(enc)-4:])
	want := crc32.ChecksumIEEE(payload) // 0xCBF43926
	if got != want || want != 0xCBF43926 {
		t.Fatalf("crc32 vector: got %#x want %#x", got, want)
	}
}
