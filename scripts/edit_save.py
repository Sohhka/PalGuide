#!/usr/bin/env python3
# Moteur d'édition de save Palworld (Phase 1 : Pals).
# Reçoit un GVAS décompressé (par Node), applique des éditions, réécrit le GVAS,
# puis RELIT le résultat pour vérifier chaque changement.
#   python edit_save.py <gvas_in> <gvas_out> <edits.json>
# Sortie : JSON de résultat sur stdout ({ ok, applied, notFound, verified, ... }).
#
# La (dé)compression .sav <-> GVAS est faite côté Node ; ce script ne touche qu'au GVAS.
# On stubbe 'palooz' (compresseur Oodle natif de palsav) : inutile ici, jamais appelé.
import sys, os, json, types

sys.modules.setdefault("palooz", types.ModuleType("palooz"))  # stub : compression gérée par Node
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # pour trouver le paquet vendorisé palsav
from palsav.gvas import GvasFile
from palsav.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS

CHAR_KEY = ".worldSaveData.CharacterSaveParameterMap.Value.RawData"

# --- Schéma des champs éditables d'un Pal : nom -> (type, fabrique de propriété) ---
def _byte(v):  return {"id": None, "value": {"type": "None", "value": int(v)}, "type": "ByteProperty"}
def _enum_gender(v):
    val = v if str(v).startswith("EPalGenderType::") else f"EPalGenderType::{v}"
    return {"id": None, "value": {"type": "EPalGenderType", "value": val}, "type": "EnumProperty"}
def _str(v):   return {"id": None, "value": str(v), "type": "StrProperty"}
def _name_array(v):
    return {"array_type": "NameProperty", "id": None, "value": {"values": list(v)}, "type": "ArrayProperty"}

BYTE_FIELDS = {
    "Talent_HP", "Talent_Shot", "Talent_Defense",
    "Level", "Rank", "Rank_HP", "Rank_Attack", "Rank_Defence", "Rank_CraftSpeed",
}

def set_field(sp, field, value):
    """Applique une valeur sur le SaveParameter d'un Pal (mute en place, ou crée la propriété si absente)."""
    if field in BYTE_FIELDS:
        if field in sp and isinstance(sp[field].get("value"), dict) and "value" in sp[field]["value"]:
            sp[field]["value"]["value"] = int(value)  # mute la feuille (largeur fixe)
        else:
            sp[field] = _byte(value)  # ajoute la propriété (le writer recalcule les tailles)
        return int(value)
    if field == "Gender":
        sp[field] = _enum_gender(value)
        return sp[field]["value"]["value"]
    if field == "NickName":
        sp[field] = _str(value)
        return value
    if field == "PassiveSkillList":
        sp[field] = _name_array(value)
        return list(value)
    raise ValueError(f"Champ non supporté : {field}")

def read_field(sp, field):
    if field not in sp:
        return None
    if field in BYTE_FIELDS:
        return sp[field]["value"]["value"]
    if field == "Gender":
        return sp[field]["value"]["value"]
    if field == "NickName":
        return sp[field]["value"]
    if field == "PassiveSkillList":
        return sp[field]["value"]["values"]
    return None

def get_save_param(entry):
    return entry["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]

def index_pals(gvas):
    """instanceId (minuscule) -> SaveParameter."""
    out = {}
    entries = gvas.properties["worldSaveData"]["value"]["CharacterSaveParameterMap"]["value"]
    for e in entries:
        try:
            iid = e["key"]["InstanceId"]["value"]
            out[str(iid).lower()] = get_save_param(e)
        except Exception:
            continue
    return out

def main():
    gvas_in, gvas_out, edits_path = sys.argv[1], sys.argv[2], sys.argv[3]
    edits = json.load(open(edits_path, encoding="utf-8"))
    pal_edits = edits.get("pals", [])

    data = open(gvas_in, "rb").read()
    cprops = {k: v for k, v in PALWORLD_CUSTOM_PROPERTIES.items() if k == CHAR_KEY}
    gvas = GvasFile.read(data, type_hints=PALWORLD_TYPE_HINTS, custom_properties=cprops)
    pals = index_pals(gvas)

    applied, not_found = [], []
    for pe in pal_edits:
        iid = str(pe["instanceId"]).lower()
        sp = pals.get(iid)
        if sp is None:
            not_found.append(iid)
            continue
        changes = {}
        for field, value in pe.get("set", {}).items():
            changes[field] = set_field(sp, field, value)
        applied.append({"instanceId": iid, "changes": changes})

    out = gvas.write(cprops)
    open(gvas_out, "wb").write(out)

    # --- vérification : relire le GVAS écrit et confirmer chaque changement ---
    gvas2 = GvasFile.read(out, type_hints=PALWORLD_TYPE_HINTS, custom_properties=cprops)
    pals2 = index_pals(gvas2)
    verified = True
    mismatches = []
    for a in applied:
        sp2 = pals2.get(a["instanceId"])
        for field, want in a["changes"].items():
            got = read_field(sp2, field) if sp2 else None
            if got != want:
                verified = False
                mismatches.append({"instanceId": a["instanceId"], "field": field, "want": want, "got": got})

    print(json.dumps({
        "ok": True,
        "gvasLen": len(out),
        "unchangedSize": len(out) == len(data),
        "appliedCount": len(applied),
        "notFound": not_found,
        "verified": verified,
        "mismatches": mismatches,
        "applied": applied,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
