import bpy, math, json, sys, os, base64
OUT = sys.argv[sys.argv.index('--') + 1]
# block ids (same as H.VOX_BLOCKS)
GRASS,DIRT,STONE,SAND,LOG,LEAVES,PLANKS,BRICK,GLASS = 1,2,3,4,5,6,7,8,9
RED,ORANGE,YELLOW,GREEN,BLUE,PURPLE,PINK,WHITE,BLACK,GOLD,LAMP = 11,12,13,14,15,16,17,18,19,20,21
SNOW,CACTUS,SPRUCE,PATH = 22,23,24,25
COL = {1:(.36,.69,.22),2:(.52,.38,.24),3:(.5,.5,.52),4:(.91,.84,.59),5:(.43,.31,.17),6:(.24,.59,.22),7:(.72,.55,.32),8:(.66,.27,.2),9:(.7,.88,.96),
       11:(.84,.24,.24),12:(.94,.55,.16),13:(.96,.82,.24),14:(.31,.71,.27),15:(.24,.43,.86),16:(.55,.35,.82),17:(.96,.51,.7),18:(.94,.94,.94),19:(.16,.16,.19),20:(1,.84,.27),21:(1,.92,.6),22:(.95,.97,1),23:(.28,.58,.24),24:(.13,.38,.2),25:(.62,.52,.38)}

class T:
    def __init__(s): s.v = {}
    def set(s, x, y, z, b): s.v[(x,y,z)] = b
    def box(s, x0,y0,z0,x1,y1,z1,b):
        for x in range(x0,x1+1):
            for y in range(y0,y1+1):
                for z in range(z0,z1+1): s.set(x,y,z,b)
    def hollow(s, x0,y0,z0,x1,y1,z1,b):
        for x in range(x0,x1+1):
            for y in range(y0,y1+1):
                for z in range(z0,z1+1):
                    if x in (x0,x1) or z in (z0,z1) or y in (y0,y1): s.set(x,y,z,b)
    def clear(s, x0,y0,z0,x1,y1,z1):
        for x in range(x0,x1+1):
            for y in range(y0,y1+1):
                for z in range(z0,z1+1): s.v.pop((x,y,z), None)

def house():
    t = T(); t.box(0,0,0,8,0,6,STONE)
    t.hollow(0,1,0,8,4,6,PLANKS); t.clear(1,1,1,7,4,5)
    t.box(0,1,0,0,1,0,LOG); [t.box(x,1,z,x,4,z,LOG) for x in (0,8) for z in (0,6)]
    t.clear(4,1,0,4,2,0)                                  # door (front = z=0)
    for x in (2,6): t.set(x,3,0,GLASS); t.set(x,3,6,GLASS)
    for z in (2,4): t.set(0,3,z,GLASS); t.set(8,3,z,GLASS)
    for k in range(5):                                      # stepped brick roof
        t.box(-1+k,5+k,-1,9-k,5+k,7,BRICK)
        if k < 4: t.clear(k,5+k,0,8-k,5+k,6) if False else None
    t.box(2,5,2,6,5,4,BRICK)
    t.box(7,5,1,7,8,1,STONE); t.set(7,9,1,STONE)            # chimney
    t.set(1,2,1,LAMP); t.set(7,2,5,LAMP)
    t.box(2,1,5,3,1,5,RED)                                  # rug bits
    return t

def tower():
    t = T(); t.box(0,0,0,6,0,6,STONE)
    t.hollow(0,1,0,6,14,6,STONE); t.clear(1,1,1,5,13,5)
    t.clear(3,1,0,3,3,0)
    for y in (5,9): [t.set(x,y,z,GLASS) for x,z in ((3,0),(3,6),(0,3),(6,3))]
    for x in range(0,7):
        for z in range(0,7):
            if x in (0,6) or z in (0,6):
                if (x+z) % 2 == 0: t.set(x,15,z,STONE)
    t.box(1,14,1,5,14,5,PLANKS); t.set(3,13,3,LAMP)
    t.box(3,1,3,3,13,3,0) if False else None
    for y in range(1,13): t.set(5,y,5,PLANKS if y % 4 else LAMP)   # ladder-ish column
    t.set(3,16,3,GOLD); t.set(3,17,3,RED)                    # flag
    return t

def castle():
    t = T(); W,D = 17,13
    t.box(0,0,0,W-1,0,D-1,STONE)
    for y in range(1,6):
        t.box(0,y,0,W-1,y,0,STONE); t.box(0,y,D-1,W-1,y,D-1,STONE); t.box(0,y,0,0,y,D-1,STONE); t.box(W-1,y,0,W-1,y,D-1,STONE)
    for x in range(0,W,2): t.set(x,6,0,STONE); t.set(x,6,D-1,STONE)
    for z in range(0,D,2): t.set(0,6,z,STONE); t.set(W-1,6,z,STONE)
    t.clear(7,1,0,9,4,0)                                     # gate
    t.box(7,5,0,9,5,0,PLANKS)
    for cx,cz in ((0,0),(W-4,0),(0,D-4),(W-4,D-4)):
        t.hollow(cx,1,cz,cx+3,9,cz+3,STONE); t.clear(cx+1,1,cz+1,cx+2,8,cz+2)
        for dx,dz in ((0,0),(3,0),(0,3),(3,3)): t.set(cx+dx,10,cz+dz,STONE)
        t.set(cx+1,5,cz,GLASS); t.set(cx+2,5,cz+3,GLASS)
        t.set(cx+1,10,cz+1,RED)
    t.hollow(5,1,4,11,7,8,BRICK); t.clear(6,1,5,10,6,7); t.clear(8,1,4,8,3,4)
    t.box(4,8,3,12,8,9,BRICK); t.set(8,9,6,GOLD); t.set(6,3,6,LAMP); t.set(10,3,6,LAMP)
    return t

def bridge():
    t = T()
    for x in range(0,15): t.box(x,2,0,x,2,2,PLANKS)
    for x in range(0,15,2): t.set(x,3,0,LOG); t.set(x,3,2,LOG)
    for x in range(1,15,2): t.set(x,3,0,PLANKS); t.set(x,3,2,PLANKS)
    for x in (0,14):
        for y in (0,1): t.box(x,y,0,x,y,2,STONE)
    for x in (4,10):
        for z in (0,2):
            for y in range(0,2): t.set(x,y,z,LOG)
    t.set(0,4,0,LAMP); t.set(14,4,0,LAMP); t.set(0,4,2,LAMP); t.set(14,4,2,LAMP)
    return t

def pyramid():
    t = T(); n = 13
    for k in range(7):
        t.box(k,k,k,n-1-k,k,n-1-k,SAND if k % 2 == 0 else STONE if False else SAND)
    t.set(6,7,6,GOLD); t.box(6,6,6,6,6,6,GOLD)
    t.clear(6,1,0,6,2,3); [t.set(6,1,z,0) for z in range(0)]
    t.box(5,1,3,7,3,5,0) if False else None
    t.clear(6,1,1,6,2,5); t.set(6,1,4,LAMP)
    return t

def treehouse():
    t = T()
    t.box(3,0,3,4,8,4,LOG)                                  # trunk
    t.box(-2,9,-2,9,9,9,PLANKS)                             # platform
    t.hollow(0,10,0,7,13,7,PLANKS); t.clear(1,10,1,6,13,6)
    t.clear(3,10,0,4,11,0)
    t.set(0,12,3,GLASS); t.set(7,12,4,GLASS); t.set(3,12,7,GLASS)
    t.box(-1,14,-1,8,14,8,BRICK); t.box(0,15,0,7,15,7,BRICK); t.box(1,16,1,6,16,6,BRICK)
    for x in range(-4,12):
        for z in range(-4,12):
            for y in range(7,13):
                if (x-3.5)**2+(z-3.5)**2+(y-10)**2*1.5 < 36 and (x,y,z) not in t.v and y>=8 and not (-2<=x<=9 and -2<=z<=9 and y<=16 and y>=9): t.set(x,y,z,LEAVES)
    for y in range(1,9): t.set(5,y,2,PLANKS)                # ladder
    t.set(2,11,2,LAMP)
    return t

def rainbow():
    t = T(); cols = [RED,ORANGE,YELLOW,GREEN,BLUE,PURPLE]
    for i,c in enumerate(cols):
        r = 9 - i
        for a in range(0,181,4):
            x = int(round(10 + r*math.cos(math.radians(a)))); y = int(round(r*math.sin(math.radians(a))))
            t.box(x,y,0,x,y,1,c)
    return t

def fountain():
    t = T(); t.box(0,0,0,8,0,8,STONE)
    t.hollow(0,1,0,8,2,8,STONE); t.clear(1,1,1,7,2,7); t.box(1,1,1,7,1,7,BLUE)
    t.box(4,1,4,4,5,4,STONE); t.set(4,6,4,GOLD); t.box(3,4,4,5,4,4,STONE); t.box(4,4,3,4,4,5,STONE)
    for x,z in ((0,0),(8,0),(0,8),(8,8)): t.set(x,3,z,LAMP)
    return t


def gable(t, x0, x1, z0, z1, y, b, rise=None):
    """גג גמלוני לאורך x: שורות שמצטמצמות לקראת הרכס (z הוא כיוון הרוחב)"""
    k = 0
    while z0 + k <= z1 - k:
        t.box(x0, y + k, z0 + k, x1, y + k, z1 - k, b); k += 1
    return k

def cottage():
    t = T(); t.box(0,0,0,6,0,5,STONE)
    t.hollow(0,1,0,6,3,5,PLANKS); t.clear(1,1,1,5,3,4)
    for x in (0,6):
        for z in (0,5): t.box(x,1,z,x,3,z,LOG)
    t.clear(3,1,0,3,2,0)
    for x in (1,5): t.set(x,2,0,GLASS); t.set(x,2,5,GLASS)
    t.set(0,2,2,GLASS); t.set(6,2,3,GLASS)
    gable(t,-1,7,-1,6,4,BLUE)
    t.box(5,4,4,5,6,4,STONE)
    t.set(2,2,2,LAMP)
    return t

def farmhouse():
    t = T(); t.box(0,0,0,10,0,6,STONE)
    t.hollow(0,1,0,10,4,6,WHITE); t.clear(1,1,1,9,4,5)
    for x in (0,5,10):
        for z in (0,6): t.box(x,1,z,x,4,z,LOG)
    t.clear(5,1,0,5,3,0); t.box(5,4,0,5,4,0,LOG)
    for x in (2,8): t.set(x,3,0,GLASS); t.set(x,3,6,GLASS)
    for z in (2,4): t.set(0,3,z,GLASS); t.set(10,3,z,GLASS)
    gable(t,-1,11,-1,7,5,RED)
    t.box(8,5,5,8,8,5,STONE); t.set(2,2,2,LAMP); t.set(8,2,4,LAMP)
    t.box(4,0,-3,6,0,-1,PATH)
    return t

def barn():
    t = T(); t.box(0,0,0,8,0,9,PLANKS)
    t.hollow(0,1,0,8,5,9,RED); t.clear(1,1,1,7,5,8)
    for x in (0,8):
        for z in (0,9): t.box(x,1,z,x,5,z,WHITE)
    t.clear(3,1,0,5,3,0)
    for y in (1,2,3): t.set(2,y,0,WHITE); t.set(6,y,0,WHITE)
    t.box(2,4,0,6,4,0,WHITE)
    gable(t,-1,9,-1,10,6,BLACK)
    t.set(4,5,0,YELLOW); t.set(4,2,3,LAMP)
    return t

def well():
    t = T(); t.hollow(0,0,0,4,1,4,STONE); t.clear(1,1,1,3,1,3); t.box(1,0,1,3,0,3,BLUE); t.box(1,1,1,3,1,3,BLUE)
    for x,z in ((0,0),(4,0),(0,4),(4,4)): t.box(x,2,z,x,4,z,LOG)
    t.box(0,5,0,4,5,4,PLANKS); t.box(1,6,1,3,6,3,PLANKS); t.set(2,4,2,LAMP)
    return t

def market():
    t = T()
    for x,z in ((0,0),(6,0),(0,4),(6,4)): t.box(x,0,z,x,3,z,LOG)
    for x in range(-1,8):
        for z in range(-1,6): t.set(x,4,z,RED if x % 2 == 0 else WHITE)
    t.box(1,0,0,5,0,0,PLANKS); t.box(1,1,0,5,1,0,PLANKS)
    t.set(2,2,0,RED); t.set(3,2,0,YELLOW); t.set(4,2,0,ORANGE)
    t.set(3,3,2,LAMP)
    return t

def windmill():
    t = T()
    for y in range(0,11):
        r = 3 if y < 8 else 2
        for x in range(-r,r+1):
            for z in range(-r,r+1):
                if max(abs(x),abs(z)) == r: t.set(x+3,y,z+3,BRICK if y % 3 else STONE)
    t.box(0,0,0,6,0,6,STONE)
    t.clear(3,1,0,3,3,0)
    for y in (5,9): t.set(3,y,0,GLASS) if y < 8 else t.set(3,y,1,GLASS)
    for k in range(3):
        r = 2 - k; t.box(3-r,11+k,3-r,3+r,11+k,3+r,RED)
    t.set(3,14,3,GOLD)
    for i in range(1,6):                                    # blades
        for dx,dy in ((i,0),(-i,0),(0,i),(0,-i)): t.set(3+dx,9+dy,-1,PLANKS if i % 2 else WHITE)
    t.set(3,9,-1,LOG); t.set(3,9,0,LOG)
    t.set(3,2,3,LAMP)
    return t

def lamppost():
    t = T(); t.box(0,0,0,0,3,0,LOG); t.set(0,4,0,LAMP); t.box(-1,5,0,1,5,0,LOG) if False else None
    return t

TEMPLATES = [('house','בית',house()),('tower','מגדל',tower()),('castle','טירה',castle()),('bridge','גשר',bridge()),
             ('pyramid','פירמידה',pyramid()),('treehouse','בית עץ',treehouse()),('rainbow','קשת צבעונית',rainbow()),('fountain','מזרקה',fountain()),
             ('cottage','בקתה',cottage()),('farmhouse','בית חווה',farmhouse()),('barn','אסם',barn()),('well','באר',well()),
             ('market','דוכן שוק',market()),('windmill','טחנת רוח',windmill()),('lamppost','עמוד תאורה',lamppost())]

def render_preview(t, path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; byb = {}
    for (x,y,z),b in t.v.items(): byb.setdefault(b, []).append((x,y,z))
    xs=[k[0] for k in t.v]; ys=[k[1] for k in t.v]; zs=[k[2] for k in t.v]
    cx=(min(xs)+max(xs)+1)/2; cy=(min(zs)+max(zs)+1)/2; cz=(min(ys)+max(ys)+1)/2
    for b,pts in byb.items():
        me = bpy.data.meshes.new('m%d'%b); ob = bpy.data.objects.new('o%d'%b, me); sc.collection.objects.link(ob)
        verts=[]; faces=[]
        for (x,y,z) in pts:
            gx,gy,gz = x, z, y                                   # game (x,y,z) -> blender (x, z, y)
            base=len(verts)
            for dx in (0,1):
                for dy in (0,1):
                    for dz in (0,1): verts.append((gx+dx-cx, gy+dy-cy, gz+dz-cz))
            for f in ((0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)): faces.append([base+i for i in f])
        me.from_pydata(verts,[],faces); me.update(); c=COL[b]; ob.color=(c[0],c[1],c[2],1)
    cam = bpy.data.cameras.new('c'); cam.type='ORTHO'
    size = max(max(xs)-min(xs), max(zs)-min(zs), max(ys)-min(ys)) + 3
    cam.ortho_scale = size * 1.25
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    d = size * 2
    co.location = (d, -d, d*.82); co.rotation_euler = (math.radians(60), 0, math.radians(45))
    sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=96; sc.render.resolution_y=96; sc.render.film_transparent=True
    sc.display.shading.color_type='OBJECT'; sc.display.shading.light='STUDIO'; sc.display.shading.show_cavity=True
    sc.display.shading.cavity_type='WORLD'; sc.render.image_settings.file_format='PNG'
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

out = []
for key, name, t in TEMPLATES:
    p = OUT + '/' + key + '.png'; render_preview(t, p)
    xs=[k[0] for k in t.v]; ys=[k[1] for k in t.v]; zs=[k[2] for k in t.v]
    x0,y0,z0 = min(xs),min(ys),min(zs)
    vox = sorted(((x-x0,y-y0,z-z0,b) for (x,y,z),b in t.v.items()), key=lambda v:(v[1],v[0],v[2]))
    out.append({'id':key,'n':name,'size':[max(xs)-x0+1,max(ys)-y0+1,max(zs)-z0+1],'count':len(vox),'v':vox,'png':base64.b64encode(open(p,'rb').read()).decode()})
    print('TEMPLATE', key, len(vox), 'blocks', len(out[-1]['png']), 'png-b64')
json.dump(out, open(OUT + '/structures.json', 'w'))
