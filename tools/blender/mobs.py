import bpy, math, json, sys, struct, base64
OUT = sys.argv[sys.argv.index('--') + 1]
PX = 1/16.0
def reset(): bpy.ops.wm.read_factory_settings(use_empty=True)
def box(part, c, s, col):
    """c = center, s = size in PIXELS, in game axes: x right, y up, z forward (+z = front)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.scale = (s[0]*PX, s[2]*PX, s[1]*PX)                         # blender (x, y=-z, z=y)
    o.location = (c[0]*PX, -c[2]*PX, c[1]*PX)
    bpy.ops.object.transform_apply(scale=True, location=True)
    o['part'] = part; o['col'] = tuple(col)
    return o
def collect():
    dg = bpy.context.evaluated_depsgraph_get(); parts = {}
    for ob in bpy.context.scene.objects:
        if 'part' not in ob: continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); me.calc_loop_triangles(); mw = ob.matrix_world
        P = parts.setdefault(ob['part'], ([], []))
        for t in me.loop_triangles:
            vs = []
            for i in t.vertices:
                p = mw @ me.vertices[i].co; vs.append((p.x, p.z, -p.y))
            P[0].append(vs); P[1].append(tuple(ob['col']))
        ev.to_mesh_clear()
    return parts
MOBS = {}
def finish(name, meta):
    parts = collect(); MOBS[name] = (parts, meta); reset()

PINK=(.96,.66,.66); PINK2=(.9,.55,.58); SNOUT=(.99,.78,.78); BLK=(.08,.08,.1); WHITE=(.96,.96,.96)
# ---------------- pig (faces +z) ----------------
reset()
box('body',(0,9,0),(10,8,16),PINK)
box('head',(0,10,10),(8,8,8),PINK); box('head',(0,9,14.6),(4,3,1.4),SNOUT)
box('head',(-2,11.5,14.1),(1.6,1.6,.6),BLK); box('head',(2,11.5,14.1),(1.6,1.6,.6),BLK)
box('head',(-3,14.4,9),(2,1.5,2),PINK2); box('head',(3,14.4,9),(2,1.5,2),PINK2)
box('legFL',(-3,3,5),(4,6,4),PINK2); box('legFR',(3,3,5),(4,6,4),PINK2); box('legBL',(-3,3,-5),(4,6,4),PINK2); box('legBR',(3,3,-5),(4,6,4),PINK2)
finish('pig', {'n':'חזיר','h':1.0,'speed':.9,'pivots':{'legFL':[-3,6,5],'legFR':[3,6,5],'legBL':[-3,6,-5],'legBR':[3,6,-5],'head':[0,10,8],'body':[0,9,0]},'kind':'quad'})
# ---------------- sheep ----------------
reset()
WOOL=(.95,.95,.95); FACE=(.78,.68,.58); LEG=(.72,.62,.52)
box('body',(0,15,0),(8,6,16),FACE); box('body',(0,15,0),(12,10,18),WOOL)
box('head',(0,17,10.5),(6,6,8),FACE); box('head',(0,19.6,9.5),(7,2,7),WOOL)
box('head',(-1.6,18,14.6),(1.2,1.2,.6),BLK); box('head',(1.6,18,14.6),(1.2,1.2,.6),BLK)
box('legFL',(-3,6,5),(4,12,4),LEG); box('legFR',(3,6,5),(4,12,4),LEG); box('legBL',(-3,6,-5),(4,12,4),LEG); box('legBR',(3,6,-5),(4,12,4),LEG)
finish('sheep', {'n':'כבשה','h':1.3,'speed':.8,'pivots':{'legFL':[-3,12,5],'legFR':[3,12,5],'legBL':[-3,12,-5],'legBR':[3,12,-5],'head':[0,17,8],'body':[0,15,0]},'kind':'quad'})
# ---------------- cow ----------------
reset()
BR=(.38,.26,.18); WH=(.94,.94,.92)
box('body',(0,16,0),(12,10,18),BR); box('body',(-3,17.5,2),(6.2,6,6),WH); box('body',(4,15,-5),(4.2,5,5),WH); box('body',(0,13.2,-3),(5,1.5,4),(.96,.72,.74))
box('head',(0,19,10.5),(8,8,6),BR); box('head',(0,17.2,13.7),(5,3.4,1.4),(.85,.8,.74))
box('head',(-2.6,20.2,13.6),(1.4,1.4,.6),BLK); box('head',(2.6,20.2,13.6),(1.4,1.4,.6),BLK)
box('head',(-4.6,23.2,10),(1.2,2.4,1.2),(.9,.88,.78)); box('head',(4.6,23.2,10),(1.2,2.4,1.2),(.9,.88,.78))
box('legFL',(-4,6,6),(4,12,4),(.3,.2,.14)); box('legFR',(4,6,6),(4,12,4),(.3,.2,.14)); box('legBL',(-4,6,-6),(4,12,4),(.3,.2,.14)); box('legBR',(4,6,-6),(4,12,4),(.3,.2,.14))
finish('cow', {'n':'פרה','h':1.5,'speed':.75,'pivots':{'legFL':[-4,12,6],'legFR':[4,12,6],'legBL':[-4,12,-6],'legBR':[4,12,-6],'head':[0,19,8],'body':[0,16,0]},'kind':'quad'})
# ---------------- chicken ----------------
reset()
CW=(.98,.98,.98); COMB=(.9,.2,.2); BEAK=(.98,.76,.2); CLEG=(.95,.72,.2)
box('body',(0,7,0),(6,6,8),CW); box('head',(0,12,3.6),(4,6,3),CW); box('head',(0,10.6,6),(2,1.6,2),BEAK); box('head',(0,15.4,3.6),(1.4,2,2.4),COMB)
box('head',(0,9.2,5.4),(1.2,2,1),COMB); box('head',(-1.4,12.6,5),(.8,.8,.5),BLK); box('head',(1.4,12.6,5),(.8,.8,.5),BLK)
box('wingL',(-3.5,8,0),(1,4,6),(.9,.9,.9)); box('wingR',(3.5,8,0),(1,4,6),(.9,.9,.9))
box('legFL',(-1.4,2,0),(1,4,1),CLEG); box('legFR',(1.4,2,0),(1,4,1),CLEG); box('tail',(0,9,-4.6),(2,4,2),(.95,.95,.95))
finish('chicken', {'n':'תרנגולת','h':.9,'speed':1.1,'pivots':{'legFL':[-1.4,4,0],'legFR':[1.4,4,0],'wingL':[-3.5,10,0],'wingR':[3.5,10,0],'head':[0,10,3.6],'body':[0,7,0]},'kind':'bird'})

out = {}; tot = 0
for name,(parts,meta) in MOBS.items():
    plist = []
    for pn,(tris,cols) in parts.items():
        pos = bytearray(); col = bytearray()
        for vs,c in zip(tris,cols):
            for v in vs:
                for k in v: pos += struct.pack('<h', max(-32767,min(32767,int(round(k*256)))))
            col += bytes(int(max(0,min(255,round(x*255)))) for x in c[:3])
        plist.append({'p':pn,'n':len(tris),'v':base64.b64encode(bytes(pos)).decode(),'c':base64.b64encode(bytes(col)).decode(),'pivot':[x*PX for x in meta['pivots'].get(pn,[0,0,0])]})
        tot += len(pos)+len(col)
    out[name] = {'name':meta['n'],'h':meta['h'],'speed':meta['speed'],'kind':meta['kind'],'parts':plist}
    print('MOB', name, sum(p['n'] for p in plist), 'tris', len(plist), 'parts')
json.dump(out, open(OUT, 'w')); print('TOTAL', tot)
