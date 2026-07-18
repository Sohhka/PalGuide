#!/usr/bin/env python3
# Lecteur de contrôle : affiche les champs d'un Pal depuis un GVAS décompressé.
#   python check_pal.py <gvas> <instanceId>
import sys, os, json, types
sys.modules.setdefault("palooz", types.ModuleType("palooz"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palsav.gvas import GvasFile
from palsav.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS

CHAR = ".worldSaveData.CharacterSaveParameterMap.Value.RawData"
data = open(sys.argv[1], "rb").read()
want_iid = sys.argv[2].lower()
cprops = {k: v for k, v in PALWORLD_CUSTOM_PROPERTIES.items() if k == CHAR}
gvas = GvasFile.read(data, type_hints=PALWORLD_TYPE_HINTS, custom_properties=cprops)

entries = gvas.properties["worldSaveData"]["value"]["CharacterSaveParameterMap"]["value"]
for e in entries:
    try:
        if str(e["key"]["InstanceId"]["value"]).lower() != want_iid:
            continue
        sp = e["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]
    except Exception:
        continue
    def g(k):
        if k not in sp: return None
        v = sp[k]
        if isinstance(v.get("value"), dict) and "value" in v["value"]: return v["value"]["value"]
        if isinstance(v.get("value"), dict) and "values" in v["value"]: return v["value"]["values"]
        return v.get("value")
    print(json.dumps({k: g(k) for k in ["CharacterID","Talent_HP","Talent_Shot","Talent_Defense","Level","Rank","Rank_HP","Gender","NickName","PassiveSkillList"]}, ensure_ascii=False))
    break
else:
    print(json.dumps({"error": "instanceId introuvable"}))
