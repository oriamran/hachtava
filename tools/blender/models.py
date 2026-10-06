import bpy, math, json, sys, base64, struct
OUT = sys.argv[sys.argv.index('--') + 1]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def prim(kind, loc=(0,0,0), scale=(1,1,1), rot=(0,0,0), col=(1,1,1), bevel=0.0, **kw):
    if kind == 'cube': bpy.ops.mesh.primitive_cube_add(size=1)
    elif kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=kw.get('v', 8), radius=kw.get('r', .5), depth=kw.get('d', 1))
    elif kind == 'cone': bpy.ops.mesh.primitive_cone_add(vertices=kw.get('v', 8), radius1=kw.get('r1', .5), radius2=kw.get('r2', 0), depth=kw.get('d', 1))
    elif kind == 'ico': bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=kw.get('s', 1), radius=kw.get('r', .5))
    o = bpy.context.object
    o.scale = scale; o.rotation_euler = [math.radians(a) for a in rot]; o.location = loc
    bpy.ops.object.transform_apply(scale=True)
    o['col'] = list(col)
    if bevel:
        m = o.modifiers.new('b', 'BEVEL'); m.width = bevel; m.segments = 1; m.limit_method = 'ANGLE'
    return o

def cylz(z0, h, r, col, v=8, r2=None, **kw):       # vertical cylinder/frustum standing on z0
    if r2 is None: return prim('cyl', (0,0,z0+h/2), col=col, v=v, r=r, d=h, **kw)
    return prim('cone', (0,0,z0+h/2), col=col, v=v, r1=r, r2=r2, d=h, **kw)

def collect():
    dg = bpy.context.evaluated_depsgraph_get(); tris = []; cols = []
    for ob in bpy.context.scene.objects:
        if 'col' not in ob: continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); me.calc_loop_triangles()
        mw = ob.matrix_world
        for t in me.loop_triangles:
            vs = []
            for i in t.vertices:
                p = mw @ me.vertices[i].co
                vs.append((p.x, p.z, -p.y))          # Blender Z-up -> game Y-up
            tris.append(vs); cols.append(tuple(ob['col']))
        ev.to_mesh_clear()
    return tris, cols

MODELS = {}
def finish(name):
    tris, cols = collect(); MODELS[name] = (tris, cols); reset()

# ---------------- cottage ----------------
reset()
prim('cube', (0,0,1.0), (3.0,2.4,2.0), col=(.97,.91,.78), bevel=.07)
prim('cone', (0,0,2.95), col=(.80,.30,.26), v=4, r1=2.45, d=1.7, rot=(0,0,45), scale=(1.0,.85,1.0))
prim('cube', (0,-1.22,.75), (.62,.1,1.3), col=(.52,.31,.18), bevel=.03)
prim('ico', (.2,-1.3,.8), col=(1,.85,.3), r=.06, s=1)
for x in (-.95, .95):
    prim('cube', (x,-1.22,1.3), (.55,.1,.55), col=(.62,.82,.95), bevel=.02)
    prim('cube', (x,-1.25,1.3), (.7,.05,.1), col=(.52,.31,.18))
    prim('cube', (x,-1.25,1.3), (.1,.05,.7), col=(.52,.31,.18))
prim('cube', (.9,.5,3.1), (.45,.45,1.1), col=(.62,.6,.64), bevel=.04)
prim('cube', (0,-1.4,.2), (2.0,.3,.25), col=(.55,.78,.4))
for x in (-.6,-.2,.2,.6): prim('ico', (x,-1.5,.45), col=([1,.5,.6],[1,.85,.3],[.8,.6,1],[1,1,1])[int((x+.6)*2.5)%4], r=.1, s=1)
finish('cottage')

# ---------------- windmill ----------------
reset()
cylz(0, 3.6, 1.35, (.96,.93,.86), v=8, r2=.85)
cylz(3.5, .35, .95, (.7,.62,.55), v=8)
prim('cone', (0,0,4.45), col=(.78,.32,.28), v=8, r1=1.05, d=1.5)
prim('cube', (0,-1.0,.7), (.7,.12,1.3), col=(.52,.31,.18), bevel=.03)
prim('cube', (0,-.95,2.2), (.5,.1,.6), col=(.62,.82,.95), bevel=.02)
prim('cyl', (0,-1.0,3.65), col=(.4,.3,.25), v=8, r=.22, d=.5, rot=(90,0,0))
finish('windmill')
reset()   # blades: in the XZ plane around origin, facing -Y
for k in range(4):
    a = k * 90
    prim('cube', (0,0,0), (.22,.12,3.4), col=(.45,.32,.22), rot=(0,a,0), bevel=.02)
    ang = math.radians(a)
    cx, cz = math.sin(ang) * 1.55, math.cos(ang) * 1.55
    # sail panel offset to one side of the spar
    px = math.cos(ang) * .3; pz = -math.sin(ang) * .3
    prim('cube', (cx + px, 0.02, cz + pz), (.75 if k % 2 else .45, .05, .45 if k % 2 else .75), col=(.98,.96,.9), rot=(0,0,0))
prim('ico', (0,-.05,0), col=(.35,.25,.2), r=.28, s=1)
finish('blades')

# ---------------- lighthouse ----------------
reset()
cylz(0, .5, 1.5, (.62,.62,.66), v=12)
z = .5; heights = [1.3,1.3,1.3,1.3]; rs = [(1.2,1.02),(1.02,.88),(.88,.78),(.78,.7)]
for i,(h,(a,b)) in enumerate(zip(heights,rs)):
    cylz(z, h, a, (.95,.95,.97) if i % 2 == 0 else (.82,.25,.25), v=12, r2=b); z += h
cylz(z, .18, 1.0, (.3,.3,.36), v=12); z += .18
cylz(z, .95, .5, (1,.95,.55), v=10); 
cylz(z, .95, .55, (.9,.95,1), v=10, r2=.5)
z += .95
prim('cone', (0,0,z+.45), col=(.82,.25,.25), v=10, r1=.8, d=.9)
prim('ico', (0,0,z+1.0), col=(1,.85,.3), r=.12, s=1)
prim('cube', (0,-1.2,.9), (.5,.1,.9), col=(.5,.3,.18), bevel=.03)
finish('lighthouse')

# ---------------- treasure chest ----------------
reset()
prim('cube', (0,0,.4), (1.2,.8,.8), col=(.62,.40,.20), bevel=.05)
prim('cyl', (0,0,.8), col=(.56,.35,.17), v=12, r=.4, d=1.2, rot=(0,90,0))
for x in (-.42,.42):
    prim('cube', (x,0,.42), (.16,.86,.84), col=(1,.8,.2), bevel=.03)
    prim('cyl', (x,0,.8), col=(1,.8,.2), v=12, r=.43, d=.16, rot=(0,90,0))
prim('cube', (0,-.42,.62), (.22,.1,.3), col=(1,.85,.3), bevel=.03)
finish('chest')

# ---------------- stone arch for portals ----------------
reset()
S = (.9,.9,.93)
prim('cyl', (0,0,.18), col=(.84,.84,.88), v=12, r=1.75, d=.36)
for sgn in (-1, 1):
    prim('cube', (sgn*1.05,0,.45), (.62,.62,.3), col=(.8,.8,.84), bevel=.04)
    prim('cyl', (sgn*1.05,0,1.5), col=S, v=8, r=.26, d=2.0)
    prim('cube', (sgn*1.05,0,2.62), (.62,.62,.22), col=(.8,.8,.84), bevel=.04)
n = 7
for i in range(n):
    a = math.pi * (i + .5) / n
    x = -math.cos(a) * 1.05; z = 2.75 + math.sin(a) * 1.05
    prim('cube', (x,0,z), (.34,.5,.32), col=(.95,.84,.4) if i == n//2 else ((.88,.88,.92) if i % 2 else (.8,.8,.85)), rot=(0, -math.degrees(a)+90, 0), bevel=.03)
finish('arch')
reset()   # small crystal, tinted at runtime
prim('cone', (0,0,.35), col=(1,1,1), v=5, r1=.3, d=.7)
prim('cone', (0,0,-.1), col=(.9,.9,.95), v=5, r1=.3, d=.4, rot=(180,0,0))
finish('crystal')

# ---------------- trees ----------------
reset()
cylz(0, 1.0, .2, (.5,.34,.2), v=6, r2=.15)
for i,(zb,r,h,c) in enumerate([(.7,1.3,1.5,(.22,.58,.32)),(1.6,1.05,1.4,(.26,.64,.34)),(2.45,.82,1.3,(.30,.70,.36)),(3.2,.55,1.2,(.34,.74,.4))]):
    prim('cone', (0,0,zb+h/2), col=c, v=7, r1=r, d=h)
finish('pine')
reset()
cylz(0, 1.1, .22, (.52,.35,.2), v=6, r2=.16)
prim('ico', (0,0,2.0), col=(.30,.68,.34), r=1.0, s=1)
prim('ico', (.55,.2,2.5), col=(.36,.74,.38), r=.65, s=1)
prim('ico', (-.5,-.2,2.35), col=(.26,.62,.32), r=.6, s=1)
finish('roundtree')

# ---------------- camp ----------------
reset()
prim('cone', (0,0,.9), col=(.95,.5,.3), v=4, r1=1.6, d=1.8, rot=(0,0,45), scale=(1,.9,1))
prim('cone', (0,-.0,.86), col=(.98,.93,.85), v=4, r1=1.62, d=1.76, rot=(0,0,45), scale=(.55,.93,1))
prim('cube', (0,-1.0,.5), (.6,.06,.95), col=(.25,.18,.14))
for k in range(6):
    a = math.radians(k*60)
    prim('cyl', (2.3+math.cos(a)*.35,math.sin(a)*.35,.12), col=(.45,.3,.18), v=6, r=.07, d=.7, rot=(90,0,math.degrees(a)+90))
prim('cone', (2.3,0,.5), col=(1,.55,.15), v=6, r1=.28, d=.7)
prim('cone', (2.3,0,.45), col=(1,.85,.3), v=6, r1=.16, d=.5)
finish('camp')

# ---------------- signpost / flag / mushroom ----------------
reset()
cylz(0, 2.0, .09, (.5,.34,.2), v=6)
prim('cube', (.35,0,1.8), (1.0,.08,.3), col=(.78,.58,.35), bevel=.03)
prim('cone', (.95,0,1.8), col=(.78,.58,.35), v=3, r1=.2, d=.3, rot=(0,90,0))
prim('cube', (-.35,0,1.35), (1.0,.08,.3), col=(.7,.5,.3), bevel=.03)
finish('sign')
reset()
cylz(0, 3.0, .06, (.9,.9,.92), v=6)
prim('cube', (.45,0,2.6), (.9,.05,.55), col=(.95,.4,.45))
prim('ico', (0,0,3.05), col=(1,.85,.3), r=.1, s=1)
finish('flag')
reset()
cylz(0, .8, .22, (.97,.93,.85), v=8)
prim('ico', (0,0,.85), col=(.88,.22,.25), r=.7, s=2, scale=(1,1,.7))
for dx,dy,dz,r in [(.3,.3,1.25,.12),(-.3,.2,1.2,.1),(.1,-.4,1.15,.11),(-.25,-.25,1.3,.09)]:
    prim('ico', (dx,dy,dz), col=(1,1,1), r=r, s=1)
finish('mushroom')

# ---------------- pier + boat ----------------
reset()
for i in range(9):
    prim('cube', (0,i*.42,0), (1.5,.38,.12), col=(.7,.5,.32) if i % 2 else (.64,.45,.28), bevel=.02)
for i in (0,4,8):
    for sgn in (-1,1):
        prim('cyl', (sgn*.7,i*.42,-.5), col=(.42,.3,.2), v=6, r=.09, d=1.2)
finish('pier')
reset()
prim('cube', (0,0,.2), (1.0,2.0,.36), col=(.75,.3,.28), bevel=.08)
prim('cone', (0,1.2,.2), col=(.75,.3,.28), v=4, r1=.55, d=.6, rot=(-90,0,45), scale=(1,.8,1))
prim('cube', (0,-.2,.5), (.9,.1,.1), col=(.9,.8,.6))
prim('cyl', (0,.3,.9), col=(.5,.35,.2), v=6, r=.05, d=1.2)
prim('cube', (.0,.28,1.05), (.04,.5,.7), col=(.97,.95,.9))
finish('boat')

# ---------------- pack ----------------
out = {}
tot = 0
for name,(tris,cols) in MODELS.items():
    pos = bytearray(); col = bytearray()
    for vs,c in zip(tris,cols):
        for v in vs:
            for k in v:
                q = max(-32767, min(32767, int(round(k*256))))
                pos += struct.pack('<h', q)
        col += bytes(int(max(0,min(255,round(x*255)))) for x in c[:3])
    out[name] = {'n': len(tris), 'v': base64.b64encode(bytes(pos)).decode(), 'c': base64.b64encode(bytes(col)).decode()}
    tot += len(pos) + len(col)
    print('MODEL', name, len(tris), 'tris')
json.dump(out, open(OUT, 'w'))
print('TOTAL_BYTES', tot)
