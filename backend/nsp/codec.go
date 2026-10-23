// Package nsp реализует кодек фреймов NSP — Nebula Sync Protocol v2.1 «RU-Lite».
//
// Структура фрейма (спека §3, FINAL):
//
//	+--------+------+------+----------+---------+--------+
//	| prefix | type | flags| length   | payload | crc32  |
//	| 4B     | 1B   | 1B   | varint   | N байт  | 4B LE  |
//	+--------+------+------+----------+---------+--------+
//
// prefix: bootstrap-фреймы (HELLO/AUTH) — well-known FA 5A 00 02;
// session-фреймы: FA 5A + 2 байта из session_id (выдаётся в AUTH_OK).
// length: varint, максимум фрейма MaxFrameSize (проверка ДО выделения буфера).
// crc32: IEEE, little-endian, считается от payload — ловит баги парсера
// и рассинхрон chunked-границ (целостность даёт TLS, не crc).
// Одно chunked-чтение может содержать несколько фреймов; границы — по length.
package nsp

import (
	"encoding/binary"
	"errors"
	"hash/crc32"
)

// MaxFrameSize — максимальный размер payload фрейма (спека §3).
const MaxFrameSize = 65536

// BootstrapPrefix — well-known префикс для HELLO/AUTH до выдачи session_id.
var BootstrapPrefix = [4]byte{0xFA, 0x5A, 0x00, 0x02}

// Типы фреймов (спека §3.5).
const (
	TypeHELLO     byte = 0x01 // C→S {protocol:2, profile, client, resume_session?, last_recv_seq?}
	TypeAUTH      byte = 0x02 // C→S {jwt}
	TypeAUTHOK    byte = 0x03 // S→C {session_id, prefix_tail, server_time_ms, heartbeat_ms, max_frame}
	TypeOPS       byte = 0x04 // C→S {tool_id, ops:[CRDTOp...]}
	TypeOPSBCAST  byte = 0x05 // S→C {tool_id, ops, from_user_id}
	TypeACK       byte = 0x06 // S→C {tool_id, acked:[op_id...], applied}
	TypeCURSOR    byte = 0x07 // обе  {tool_id, user_id, x, y, color}
	TypeSTATEREQ  byte = 0x08 // C→S {tool_id}
	TypeSTATE     byte = 0x09 // S→C {tool_id, state:{elements:...}}
	TypeEVENT     byte = 0x0A // S→C события мессенджера (payload как в SSE-hub)
	TypePING      byte = 0x0B // обе  {ts}
	TypePONG      byte = 0x0C // обе  {ts}
	TypeERROR     byte = 0x0D // S→C {code, message}
	TypeCLOSE     byte = 0x0E // обе  {reason}
	TypeSUBSCRIBE byte = 0x0F // C→S {channels:[{channel_id, tool_id}]}
)

// Flags (спека §3): bit0 = zstd, bit2 = требует ACK.
const (
	FlagZstd      byte = 1 << 0
	FlagNeedAck   byte = 1 << 2
)

// ERROR-коды (спека §3.5).
const (
	ErrCodeBadAuth           = 4001 // bad_auth
	ErrCodeAccessDenied      = 4003 // access_denied
	ErrCodeNotFound          = 4004 // not_found
	ErrCodeSessionExpired    = 4005 // session_expired
	ErrCodeBufferOverflow    = 4006 // buffer_overflow
	ErrCodeTransportDisabled = 4503 // transport_disabled
	ErrCodeKillSwitch        = 4600 // kill_switch
)

// Ошибки декодера. Все ошибки не фатальны для потока: декодер делает
// resync на следующее вхождение префикса и продолжает разбор.
var (
	ErrBadPrefix      = errors.New("nsp: invalid frame prefix")
	ErrFrameTooLarge  = errors.New("nsp: frame length exceeds 65536")
	ErrCRCMismatch    = errors.New("nsp: crc32 mismatch")
	ErrVarintOverflow = errors.New("nsp: varint overflow")
)

// Frame — декодированный фрейм.
type Frame struct {
	Prefix  [4]byte
	Type    byte
	Flags   byte
	Payload []byte
}

// SessionPrefix строит session-префикс: FA 5A + 2 байта из session_id.
func SessionPrefix(b0, b1 byte) [4]byte {
	return [4]byte{0xFA, 0x5A, b0, b1}
}

// Encode кодирует фрейм. payload длиннее MaxFrameSize отклоняется.
func Encode(prefix [4]byte, typ, flags byte, payload []byte) ([]byte, error) {
	if len(payload) > MaxFrameSize {
		return nil, ErrFrameTooLarge
	}
	out := make([]byte, 0, 4+2+binary.MaxVarintLen64+len(payload)+4)
	out = append(out, prefix[:]...)
	out = append(out, typ, flags)
	out = binary.AppendUvarint(out, uint64(len(payload)))
	out = append(out, payload...)
	crc := crc32.ChecksumIEEE(payload)
	var crcBuf [4]byte
	binary.LittleEndian.PutUint32(crcBuf[:], crc)
	out = append(out, crcBuf[:]...)
	return out, nil
}

// MustEncode — Encode для заведомо валидных payload (тесты, внутренние фреймы).
func MustEncode(prefix [4]byte, typ, flags byte, payload []byte) []byte {
	b, err := Encode(prefix, typ, flags, payload)
	if err != nil {
		panic(err)
	}
	return b
}

// Decoder — потоковый декодер фреймов с внутренним буфером.
// Границы фреймов определяются length, а не границами чтений:
// одно чтение может нести несколько фреймов, фрейм может быть оборван
// посередине — Next вернёт (nil, nil) и дождётся дочитки.
type Decoder struct {
	prefix [4]byte // ожидаемый префикс (bootstrap или session)
	buf    []byte
}

// NewDecoder создаёт декодер для потока фреймов с указанным префиксом.
func NewDecoder(prefix [4]byte) *Decoder {
	return &Decoder{prefix: prefix}
}

// Feed добавляет прочитанные из транспорта байты во внутренний буфер.
func (d *Decoder) Feed(p []byte) {
	d.buf = append(d.buf, p...)
}

// Buffered возвращает количество неразобранных байт в буфере.
func (d *Decoder) Buffered() int { return len(d.buf) }

// TakeBuffered забирает неразобранный остаток буфера (и очищает его).
// Используется при смене ожидаемого префикса: байты, прочитанные одним
// чанком с последним bootstrap-фреймом, переносятся в session-декодер.
func (d *Decoder) TakeBuffered() []byte {
	p := d.buf
	d.buf = nil
	return p
}

// Next извлекает следующий фрейм.
//
//	(f, nil)   — фрейм декодирован;
//	(nil, nil) — данных не хватает (обрыв посередине фрейма), ждём дочитки;
//	(nil, err) — мусор/битый фрейм отброшен, декодер сделал resync и его
//	             можно вызывать снова.
func (d *Decoder) Next() (*Frame, error) {
	// Минимальный заголовок: prefix(4) + type(1) + flags(1) + varint(>=1).
	if len(d.buf) < 7 {
		return nil, nil
	}

	// Проверка префикса; при мусоре — resync на следующее вхождение FA 5A.
	if !d.prefixMatches(d.buf) {
		d.resync()
		return nil, ErrBadPrefix
	}

	rest := d.buf[6:]
	length, n := binary.Uvarint(rest)
	if n == 0 {
		// varint оборван — ждём дочитки (если буфер разумного размера)
		if len(rest) >= binary.MaxVarintLen64 {
			d.resync()
			return nil, ErrVarintOverflow
		}
		return nil, nil
	}
	if n < 0 {
		d.resync()
		return nil, ErrVarintOverflow
	}

	// Спека §3: проверка лимита ДО выделения буфера под payload.
	if length > MaxFrameSize {
		d.resync()
		return nil, ErrFrameTooLarge
	}

	frameLen := 6 + n + int(length) + 4
	if len(d.buf) < frameLen {
		// Фрейм оборван посередине — ждём дочитки, буфер не трогаем.
		return nil, nil
	}

	payload := d.buf[6+n : 6+n+int(length)]
	crcWant := binary.LittleEndian.Uint32(d.buf[6+n+int(length) : frameLen])
	if crc32.ChecksumIEEE(payload) != crcWant {
		// Битый фрейм отбрасываем целиком (граница известна по length).
		d.buf = d.buf[frameLen:]
		return nil, ErrCRCMismatch
	}

	f := &Frame{
		Type:    d.buf[4],
		Flags:   d.buf[5],
		Prefix:  d.prefix,
		Payload: append([]byte(nil), payload...),
	}
	d.buf = d.buf[frameLen:]
	return f, nil
}

func (d *Decoder) prefixMatches(b []byte) bool {
	return b[0] == d.prefix[0] && b[1] == d.prefix[1] && b[2] == d.prefix[2] && b[3] == d.prefix[3]
}

// resync отбрасывает мусор до следующего возможного начала фрейма (FA 5A).
func (d *Decoder) resync() {
	for i := 1; i < len(d.buf)-1; i++ {
		if d.buf[i] == 0xFA && d.buf[i+1] == 0x5A {
			d.buf = d.buf[i:]
			return
		}
	}
	// Оставляем хвост из одного байта 0xFA — может быть началом префикса,
	// оборванного границей чтения.
	if len(d.buf) > 0 && d.buf[len(d.buf)-1] == 0xFA {
		d.buf = d.buf[len(d.buf)-1:]
	} else {
		d.buf = d.buf[:0]
	}
}
