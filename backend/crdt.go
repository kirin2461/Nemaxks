package main

import "encoding/json"

// CRDTElement — элемент LWW-Element-Map.
// Побеждает операция с большим lamport; при равенстве — с большим user_id.
// delete выставляет tombstone (deleted=true), элемент физически не удаляется.
type CRDTElement struct {
	Value   interface{} `json:"value"`
	Lamport int64       `json:"lamport"`
	UserID  uint        `json:"user_id"`
	Deleted bool        `json:"deleted"`
}

// CRDTOp — операция синхронизации от клиента.
type CRDTOp struct {
	OpID      string      `json:"op_id"`
	ElementID string      `json:"element_id"`
	Action    string      `json:"action"` // "set" | "delete"
	Value     interface{} `json:"value,omitempty"`
	Lamport   int64       `json:"lamport"`
	UserID    uint        `json:"user_id"`
}

// CRDTDocument — корневой документ: {"elements": {"<element_id>": CRDTElement}}
type CRDTDocument struct {
	Elements map[string]CRDTElement `json:"elements"`
}

// ApplyCRDTOps применяет пачку операций к contentJSON по merge-правилу LWW-Element-Map.
// Пустой или битый content → начинаем с {"elements":{}}.
// Возвращает новый JSON и количество реально применённых (выигравших) операций.
func ApplyCRDTOps(contentJSON string, ops []CRDTOp) (newJSON string, applied int) {
	doc := CRDTDocument{Elements: make(map[string]CRDTElement)}
	if contentJSON != "" {
		var parsed CRDTDocument
		if err := json.Unmarshal([]byte(contentJSON), &parsed); err == nil && parsed.Elements != nil {
			doc = parsed
		}
	}

	for _, op := range ops {
		if op.ElementID == "" || (op.Action != "set" && op.Action != "delete") {
			continue
		}

		existing, ok := doc.Elements[op.ElementID]
		if ok && (existing.Lamport > op.Lamport ||
			(existing.Lamport == op.Lamport && existing.UserID >= op.UserID)) {
			// Существующая запись новее (или равна с большим/равным user_id) — операция проигрывает
			continue
		}

		elem := CRDTElement{
			Lamport: op.Lamport,
			UserID:  op.UserID,
		}
		if op.Action == "delete" {
			elem.Deleted = true
			if ok {
				elem.Value = existing.Value // сохраняем значение в tombstone
			}
		} else {
			elem.Value = op.Value
		}
		doc.Elements[op.ElementID] = elem
		applied++
	}

	data, err := json.Marshal(doc)
	if err != nil {
		return `{"elements":{}}`, applied
	}
	return string(data), applied
}
