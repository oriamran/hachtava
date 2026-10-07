# מודלים תלת־ממדיים (Blender)

`models.py` בונה את המודלים של האי (בקתה, טחנת רוח, מגדלור, שער אבן, עצים ועוד) ומייצא אותם.

להרצה (נדרש Blender 4+/5):

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/models.py -- /tmp/models.json
```

אחר כך אורזים את `/tmp/models.json` לקובץ `v2/src/js/98-models.js` (`H.MODELS = {...}`) ומריצים `node v2/build.mjs`.
הפורמט: לכל מודל `n` משולשים, `v` מיקומים (int16 מחולקים ב־256, בסיס64) ו־`c` צבע לכל משולש (בייטים, בסיס64).

## תבניות בנייה (`structures.py`)

```bash
mkdir -p /tmp/vxs && /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/structures.py -- /tmp/vxs
```

הפלט `/tmp/vxs/structures.json` נארז ל-`v2/src/js/98c-structures.js` (`H.VOX_TEMPLATES`): לכל תבנית `v` הוא בייטים (x,y,z,בלוק) בבסיס64.
