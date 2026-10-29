# Builds a GDevelop project (game.json + assets/) with the 4 levels from ../levels.js plus EXTRA below.
# Level design only: no session timer, breaks or end-of-play effects.
# 48 px tiles, GDevelop defaults where they fit; only 2 variables (Coins, AirJumps).
# Run: python3 gdevelop/make.py   (needs node to read levels.js)
import json, os, struct, subprocess, uuid, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
T = 16
LEVELS = json.loads(subprocess.check_output(
    ['node', '-e', "eval(require('fs').readFileSync('levels.js','utf8')+';console.log(JSON.stringify(LEVELS))')"],
    cwd=os.path.dirname(HERE)))
# Extra levels made for GDevelop only (the web game keeps its 4). Same map letters as levels.js.
EXTRA = [
    {'name': '5 · CRYSTAL CAVES', 'sky': ['#2d1b4e', '#5b3a7a'], 'ground': '#3d4a6b', 'grass': '#b28dff', 'brick': '#6c5a8e', 'enemySpeed': 1.0,
     'map': [
        '',
        '',
        '',
        '                                      oo                 o o o                        oo',
        '                                      ##                    E                         ##',
        '                 E                    ##                BBBBBBBB                      ##                   E',
        '              BBBBBBBoooo             ##       oooo                    oooo           ##       oooo     BBBBBBB   oooo',
        '                                      ##                                              ##',
        '    P     ^^^  E            E ^^^  E  ##  ^^         F  E     E ^^^           E ^^^   ##  E          F    ^^^               ^^^     E    D',
        '###################       ###################       #################       #################       #############      #####################',
        '###################       ###################       #################       #################       #############      #####################',
    ]},
    {'name': '6 · LAVA PEAKS', 'sky': ['#ff6b4a', '#ffd166'], 'ground': '#5a3a3a', 'grass': '#ff9f43', 'brick': '#8b3a3a', 'enemySpeed': 1.15,
     'map': [
        '',
        '',
        '',
        '                                  oo                 o o o                  oo                                            oo',
        '                                  ##                   E                    ##                                            ##',
        '            E                     ##                BBBBBBB                 ##                       E                    ##',
        '          BBBBB   oooo            ##      oooo                  oooo        ##          ooooo     BBBBBBB   oooo          ##      oooo',
        '                                  ##                                        ##                                            ##',
        '   P   ^^^    E           E ^^^ E ##  ^^          E ^^^  E ^^ F         ^^^ ##  E ^^^           E ^^^ E ^^        F   ^^^ ##E ^^          E ^^^  E D',
        '#################       #################       ###############       #################        ############       ###############       ##############',
        '#################       #################       ###############       #################        ############       ###############       ##############',
    ]},
]
LEVELS += EXTRA
os.makedirs(os.path.join(HERE, 'assets'), exist_ok=True)

# --- tiny RGBA image drawing, same rects as game.js, saved 3x bigger (48 px tiles) ---
S = 3        # pixel scale
W = T * S    # tile size in the scene
def rgba(c):
    if c.startswith('rgba'):
        r, g, b, a = c[5:-1].split(',')
        return int(r), int(g), int(b), float(a)
    c = c.lstrip('#')
    if len(c) == 3: c = ''.join(ch * 2 for ch in c)
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), (int(c[6:8], 16) / 255 if len(c) == 8 else 1)

LIGHT, DARK, INK = 'rgba(255,255,255,.3)', 'rgba(0,0,0,.18)', '#1b1f4b'

class Img:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, [[(0, 0, 0, 0)] * w for _ in range(h)]
    def rect(s, x, y, w, h, c):
        r, g, b, a = rgba(c)
        for yy in range(max(0, y), min(s.h, y + h)):
            for xx in range(max(0, x), min(s.w, x + w)):
                R, G, B, A = s.px[yy][xx]
                na = a + A * (1 - a)
                s.px[yy][xx] = tuple(int((v * a + V * A * (1 - a)) / na) if na else 0
                                     for v, V in ((r, R), (g, G), (b, B))) + (na,)
        return s
    def save(s, name):
        raw = b''.join(b'\0' + b''.join(bytes((*p[:3], round(p[3] * 255))) * S for p in r) for r in s.px for _ in range(S))
        chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
        with open(os.path.join(HERE, 'assets', name + '.png'), 'wb') as f:
            f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', s.w * S, s.h * S, 8, 6, 0, 0, 0))
                    + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
        return name

def ground(L, grass):
    i = Img(T, T).rect(0, 0, T, T, L['ground']).rect(5, 8, 3, 1, DARK).rect(10, 12, 2, 1, DARK)
    i.rect(0, T - 1, T, 1, DARK).rect(T - 1, 0, 1, T, DARK).rect(0, 0, 1, T, LIGHT)
    if grass:
        i.rect(0, 0, T, 4, L['grass']).rect(0, 0, T, 1, LIGHT).rect(3, 4, 2, 3, L['grass']).rect(11, 4, 1, 2, L['grass'])
    return i

def brick(L):
    i = Img(T, T).rect(0, 0, T, T, L['brick']).rect(0, 0, T, 1, LIGHT)
    i.rect(0, 7, T, 1, DARK).rect(0, 15, T, 1, DARK)
    return i.rect(7, 0, 1, 7, DARK).rect(3, 8, 1, 7, DARK).rect(11, 8, 1, 7, DARK)

spikes = Img(T, T)
for k in range(4):
    spikes.rect(k * 4 + 1, 8, 2, 8, '#e8ecf5').rect(k * 4, 12, 4, 4, '#e8ecf5').rect(k * 4 + 2, 9, 1, 7, DARK)
player = (Img(10, 15).rect(1, 4, 8, 1, '#fff').rect(0, 5, 10, 9, '#fff').rect(0, 5, 1, 9, '#d7dcef')
          .rect(5, 7, 1, 2, INK).rect(8, 7, 1, 2, INK).rect(2, 0, 6, 4, '#e63946').rect(2, 0, 6, 1, LIGHT)
          .rect(1, 1, 1, 3, INK).rect(1, 14, 3, 1, INK).rect(6, 14, 3, 1, INK))
marker = lambda c: Img(T, T).rect(0, 0, T, T, c)
shared = {  # name: (image, x offset, y offset) relative to the tile corner, in game.js pixels
    'Player': (player, 3, 1),
    'Spawn': (player, 3, 1),  # respawn point: starts on the player, moves to each checkpoint touched
    'Enemy': (Img(12, 12).rect(1, 0, 10, 12, '#6b4fa0').rect(0, 2, 12, 10, '#6b4fa0').rect(1, 0, 10, 1, LIGHT)
              .rect(2, 3, 3, 3, '#fff').rect(7, 3, 3, 3, '#fff').rect(3, 4, 1, 2, INK).rect(8, 4, 1, 2, INK), 2, 4),
    'Cube': (Img(T, T).rect(4, 4, 8, 3, '#fff3a6').rect(4, 7, 4, 5, '#ffd84a').rect(8, 7, 4, 5, '#d99a1e'), 0, 0),
    'Spikes': (spikes, 0, 0),
    'Checkpoint': (Img(T, T).rect(7, 1, 2, 15, '#ece3d0').rect(9, 2, 6, 5, '#8a8fb0'), 0, 0),
    'Door': (Img(20, 26).rect(0, 2, 20, 24, '#ece3d0').rect(2, 0, 16, 2, '#ece3d0')
             .rect(4, 4, 12, 22, '#2a1f3d').rect(6, 2, 8, 2, '#2a1f3d'), -2, -10),
    # invisible in game: an enemy touching TurnRight walks right, touching TurnLeft walks left
    'TurnRight': (marker('#4ade8088'), 0, 0),
    'TurnLeft': (marker('#f8717188'), 0, 0),
}
CHAR = {'o': 'Cube', '^': 'Spikes', 'E': 'Enemy', 'F': 'Checkpoint', 'P': 'Player', 'D': 'Door', 'B': 'Brick'}

# --- GDevelop JSON pieces (format copied from a GDevelop 5.6 project) ---
uid = lambda: str(uuid.uuid4())
# Platform has GDevelop's default values. The player's fall and jump are game.js scaled 3x: GDevelop's own
# 1000 gravity floats at 48 px tiles. GDevelop slows a rising jump with gravity twice, so jump 1260 rises
# 3.4 tiles in 0.26 s, and no jump sustain (holding Space doesn't float). Walk 288 = game.js 1.6 px/frame.
GRAVITY, SPEED = 2400, 288
PLATFORM = {'name': 'Platform', 'type': 'PlatformBehavior::PlatformBehavior', 'canBeGrabbed': True,
            'platformType': 'NormalPlatform', 'yGrabOffset': 0}
PLAYER = {'name': 'PlatformerObject', 'type': 'PlatformBehavior::PlatformerObjectBehavior', 'acceleration': 1500,
          'canGoDownFromJumpthru': True, 'canGrabPlatforms': False, 'canGrabWithoutMoving': True, 'deceleration': 1500,
          'gravity': GRAVITY, 'ignoreDefaultControls': False, 'jumpSpeed': 1260, 'jumpSustainTime': 0,
          'ladderClimbingSpeed': 150, 'maxFallingSpeed': 1260, 'maxSpeed': SPEED, 'slopeMaxAngle': 60,
          'useLegacyTrajectory': False, 'useRepeatedJump': False, 'xGrabTolerance': 10, 'yGrabOffset': 0}

def sprite(name, *images, behaviors=()):  # one animation per image; the first is the default ('')
    return {'adaptCollisionMaskAutomatically': True, 'assetStoreId': '', 'name': name, 'persistentUuid': uid(),
            'type': 'Sprite', 'updateIfNotVisible': False, 'variables': [], 'effects': [], 'behaviors': list(behaviors),
            'animations': [{'name': anim, 'useMultipleDirections': False, 'directions': [{
                'looping': False, 'timeBetweenFrames': 0.08, 'sprites': [{
                    'hasCustomCollisionMask': False, 'image': image, 'points': [],
                    'originPoint': {'name': 'origine', 'x': 0, 'y': 0},
                    'centerPoint': {'automatic': True, 'name': 'centre', 'x': 0, 'y': 0},
                    'customCollisionMask': []}]}]} for anim, image in images]}

num = lambda name, value: {'name': name, 'type': 'number', 'value': value}

def instance(name, x, y, z=1, layer=''):
    return {'angle': 0, 'customSize': False, 'depth': 1, 'height': 0, 'keepRatio': True, 'layer': layer, 'name': name,
            'persistentUuid': uid(), 'width': 0, 'x': x, 'y': y, 'zOrder': z,
            'numberProperties': [], 'stringProperties': [], 'initialVariables': []}

def cond(kind, *params, inverted=False):
    return {'type': {'inverted': inverted, 'value': kind}, 'parameters': list(params)}
act = lambda kind, *params: {'type': {'value': kind}, 'parameters': list(params)}
event = lambda conditions, actions: {'type': 'BuiltinCommonInstructions::Standard', 'conditions': conditions, 'actions': actions}
either = lambda *conditions: {'type': {'value': 'BuiltinCommonInstructions::Or'}, 'parameters': [], 'subInstructions': list(conditions)}
P = ('Player', 'PlatformerObject')
touch = lambda obj: cond('CollisionNP', 'Player', obj, '', '', '')

def scene_events(nxt, width, enemy_speed):
    return [
        event([cond('SceneJustBegins', '')],
              [act('Hide', 'Spawn'), act('Hide', 'TurnRight'), act('Hide', 'TurnLeft'),
               act('ResetObjectTimer', 'Player', '"dash"')]),
        event([], [act('SetCameraCenterX', '', '=', f'clamp(Player.CenterX(), 480, {width - 480})', '', '0'),
                   act('SetCameraCenterY', '', '=', f'{11 * W // 2}', '', '0'),
                   act('TextContainerCapability::TextContainerBehavior::SetValue', 'CoinText', 'Text', '=',
                       '"Coins: " + ToString(Coins)')]),
        # enemies walk left, or right when flipped, and turn at the markers
        event([cond('FlippableCapability::FlippableBehavior::FlippedX', 'Enemy', 'Flippable', inverted=True)],
              [act('SetXY', 'Enemy', '-', f'{enemy_speed} * TimeDelta()', '+', '0')]),
        event([cond('FlippableCapability::FlippableBehavior::FlippedX', 'Enemy', 'Flippable')],
              [act('SetXY', 'Enemy', '+', f'{enemy_speed} * TimeDelta()', '+', '0')]),
        event([cond('CollisionNP', 'Enemy', 'TurnRight', '', '', '')],
              [act('FlippableCapability::FlippableBehavior::FlipX', 'Enemy', 'Flippable', 'yes')]),
        event([cond('CollisionNP', 'Enemy', 'TurnLeft', '', '', '')],
              [act('FlippableCapability::FlippableBehavior::FlipX', 'Enemy', 'Flippable', 'no')]),
        # player faces where it walks
        event([cond('PlatformBehavior::PlatformerObjectBehavior::IsUsingControl', *P, '"Left"')],
              [act('FlippableCapability::FlippableBehavior::FlipX', 'Player', 'Flippable', 'yes')]),
        event([cond('PlatformBehavior::PlatformerObjectBehavior::IsUsingControl', *P, '"Right"')],
              [act('FlippableCapability::FlippableBehavior::FlipX', 'Player', 'Flippable', 'no')]),
        event([touch('Cube')], [act('Delete', 'Cube', ''), act('SetNumberVariable', 'Coins', '+', '1')]),
        # double jump: Space in the air allows one more jump, landing resets it
        event([cond('PlatformBehavior::IsOnFloor', *P)], [act('SetNumberVariable', 'AirJumps', '=', '0')]),
        event([cond('KeyFromTextJustPressed', '', '"Space"'), cond('PlatformBehavior::IsOnFloor', *P, inverted=True),
               cond('NumberVariable', 'AirJumps', '=', '0')],
              [act('PlatformBehavior::SetCanJump', *P), act('SetNumberVariable', 'AirJumps', '=', '1')]),
        # dash (X): gravity 0 means dashing; lasts 0.2 s, then 0.4 s before the next one
        event([cond('KeyFromTextJustPressed', '', '"x"'), cond('CompareObjectTimer', 'Player', '"dash"', '>', '0.6')],
              [act('ResetObjectTimer', 'Player', '"dash"'), act('PlatformBehavior::PlatformerObjectBehavior::AbortJump', *P),
               act('PlatformBehavior::Gravity', *P, '=', '0'), act('PlatformBehavior::MaxSpeed', *P, '=', '700')]),
        event([cond('PlatformBehavior::Gravity', *P, '=', '0'),
               cond('FlippableCapability::FlippableBehavior::FlippedX', 'Player', 'Flippable')],
              [act('PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed', *P, '=', '-700')]),
        event([cond('PlatformBehavior::Gravity', *P, '=', '0'),
               cond('FlippableCapability::FlippableBehavior::FlippedX', 'Player', 'Flippable', inverted=True)],
              [act('PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed', *P, '=', '700')]),
        event([cond('PlatformBehavior::Gravity', *P, '=', '0'), cond('CompareObjectTimer', 'Player', '"dash"', '>', '0.2')],
              [act('PlatformBehavior::Gravity', *P, '=', str(GRAVITY)), act('PlatformBehavior::MaxSpeed', *P, '=', str(SPEED))]),
        # dash into an enemy or land on it = knock it out (landing also bounces)
        event([touch('Enemy'), cond('PlatformBehavior::Gravity', *P, '=', '0')], [act('Delete', 'Enemy', '')]),
        event([touch('Enemy'), cond('PlatformBehavior::IsFalling', *P)],
              [act('Delete', 'Enemy', ''), act('PlatformBehavior::SetCanJump', *P), act('PlatformBehavior::SimulateJumpKey', *P)]),
        # checkpoint: lights up and moves the respawn point there
        event([touch('Checkpoint')],
              [act('AnimatableCapability::AnimatableBehavior::SetName', 'Checkpoint', 'Animation', '=', '"lit"'),
               act('SetXY', 'Spawn', '=', f'Checkpoint.X() + {3 * S}', '=', f'Checkpoint.Y() + {S}')]),
        # dying: back to the respawn point (start of the level, or the last checkpoint)
        event([either(touch('Enemy'), touch('Spikes'),
                      cond('BuiltinCommonInstructions::CompareNumbers', 'Player.Y()', '>', f'{12 * W}'))],
              [act('SetXY', 'Player', '=', 'Spawn.X()', '=', 'Spawn.Y()'),
               act('PlatformBehavior::PlatformerObjectBehavior::AbortJump', *P),
               act('PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed', *P, '=', '0'),
               act('PlatformBehavior::PlatformerObjectBehavior::SetCurrentFallSpeed', *P, '=', '0')]),
        event([touch('Door')], [act('Scene', '', f'"{nxt}"', '')]),
    ]

resources, layouts = [], []
def res(name):
    resources.append({'file': f'assets/{name}.png', 'kind': 'image', 'metadata': '', 'name': name,
                      'smoothed': False, 'userAdded': True})
    return name

for name, (img, _, _) in shared.items():
    if name != 'Spawn':
        res(img.save(name.lower()))
res(Img(T, T).rect(7, 1, 2, 15, '#ece3d0').rect(9, 2, 6, 5, '#ffd84a').save('checkpoint_lit'))
coin_text = {'assetStoreId': '', 'bold': False, 'italic': False, 'name': 'CoinText', 'smoothed': True,
             'type': 'TextObject::Text', 'underlined': False, 'variables': [], 'effects': [], 'behaviors': [],
             'string': 'Coins: 0', 'font': '', 'textAlignment': 'left', 'characterSize': 24,
             'color': {'b': 255, 'g': 255, 'r': 255},
             'content': {'bold': True, 'isOutlineEnabled': True, 'isShadowEnabled': False, 'italic': False,
                         'outlineColor': '27;31;75', 'outlineThickness': 4, 'shadowAngle': 90,
                         'shadowBlurRadius': 2, 'shadowColor': '0;0;0', 'shadowDistance': 4,
                         'shadowOpacity': 127, 'smoothed': True, 'underlined': False, 'text': 'Coins: 0',
                         'font': '', 'textAlignment': 'left', 'verticalTextAlignment': 'top',
                         'characterSize': 24, 'lineHeight': 0, 'color': '255;255;255'}}
names = [f'Level{n + 1}' for n in range(len(LEVELS))]
for n, L in enumerate(LEVELS):
    rows = L['map']
    width = max(map(len, rows)) * W
    tile = lambda x, y: rows[y][x] if 0 <= y < len(rows) and 0 <= x < len(rows[y]) else ' '
    solid = lambda x, y: tile(x, y) in '#B'
    p = f'l{n + 1}_'
    for k, img in (('ground', ground(L, False)), ('grass', ground(L, True)), ('brick', brick(L))):
        res(img.save(p + k))
    objects = [sprite('Ground', ('', p + 'ground'), behaviors=[PLATFORM]),
               sprite('Grass', ('', p + 'grass'), behaviors=[PLATFORM]),
               sprite('Brick', ('', p + 'brick'), behaviors=[PLATFORM]),
               sprite('Player', ('', 'player'), behaviors=[PLAYER]), sprite('Spawn', ('', 'player')),
               sprite('Checkpoint', ('', 'checkpoint'), ('lit', 'checkpoint_lit'))]
    objects += [sprite(k, ('', k.lower())) for k in ('Enemy', 'Cube', 'Spikes', 'Door', 'TurnRight', 'TurnLeft')]
    objects.append(coin_text)
    put = lambda obj, x, y, z=1: instances.append(
        instance(obj, (x * T + shared[obj][1]) * S, (y * T + shared[obj][2]) * S, z))
    instances = [instance('CoinText', 16, 10, 10, 'HUD')]
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == '#':
                instances.append(instance('Ground' if solid(x, y - 1) else 'Grass', x * W, y * W))
            elif c == 'B':
                instances.append(instance('Brick', x * W, y * W))
            elif c in CHAR:
                put(CHAR[c], x, y, 2 if c in 'PE' else 1)
                if c == 'P':
                    put('Spawn', x, y)
                if c == 'E':  # markers just past the ends of the enemy's platform (a wall or where the ground ends)
                    lo, hi = x, x
                    while not solid(lo - 1, y) and solid(lo - 1, y + 1): lo -= 1
                    while not solid(hi + 1, y) and solid(hi + 1, y + 1): hi += 1
                    put('TurnRight', lo - 1, y)
                    put('TurnLeft', hi + 1, y)
    r, g, b, _ = rgba(L['sky'][0])
    layouts.append({
        'b': b, 'disableInputWhenNotFocused': True, 'mangledName': names[n], 'name': names[n], 'r': r, 'v': g,
        'standardSortMethod': True, 'stopSoundsOnStartup': True, 'title': L['name'],
        'uiSettings': {'grid': True, 'gridType': 'rectangular', 'gridWidth': W, 'gridHeight': W, 'gridDepth': W,
                       'gridOffsetX': 0, 'gridOffsetY': 0, 'gridOffsetZ': 0, 'gridColor': 10401023, 'gridAlpha': 0.8,
                       'snap': True, 'zoomFactor': 0.7, 'windowMask': False, 'selectedLayer': '',
                       'gameEditorMode': 'instances-editor'},
        'objectsGroups': [], 'variables': [num('AirJumps', 0)],
        'instances': instances, 'objects': objects,
        'objectsFolderStructure': {'folderName': '__ROOT', 'children': [{'objectName': o['name']} for o in objects]},
        'events': scene_events(names[(n + 1) % len(names)], width, round(L['enemySpeed'] * 60 * S)),
        'layers': [{'ambientLightColorB': 200, 'ambientLightColorG': 200, 'ambientLightColorR': 200,
                    'camera2DPlaneMaxDrawingDistance': 5000, 'camera3DFarPlaneDistance': 10000,
                    'camera3DFieldOfView': 45, 'camera3DNearPlaneDistance': 3, 'cameraType': '',
                    'followBaseLayerCamera': False, 'isLightingLayer': False, 'isLocked': False, 'name': name,
                    'renderingType': '', 'visibility': True,
                    'cameras': [{'defaultSize': True, 'defaultViewport': True, 'height': 0, 'viewportBottom': 1,
                                 'viewportLeft': 0, 'viewportRight': 1, 'viewportTop': 0, 'width': 0}],
                    'effects': []} for name in ('', 'HUD')],  # HUD: fixed camera, so the coin text stays put
        'behaviorsSharedData': [],
    })

project = {
    'firstLayout': names[0],
    'gdVersion': {'build': 274, 'major': 5, 'minor': 6, 'revision': 0},
    'properties': {'adaptGameResolutionAtRuntime': True, 'antialiasingMode': 'none', 'antialisingEnabledOnMobile': False,
                   'folderProject': False, 'orientation': 'landscape', 'packageName': 'com.example.cubehop',
                   'pixelsRounding': True, 'projectUuid': uid(), 'scaleMode': 'nearest', 'sizeOnStartupMode': 'adaptWidth',
                   'templateSlug': '', 'version': '1.0.0', 'name': 'Cube Hop Levels', 'description': '', 'author': '',
                   'windowWidth': 960, 'windowHeight': 11 * W, 'latestCompilationDirectory': '', 'maxFPS': 60,
                   'minFPS': 20, 'verticalSync': False, 'platformSpecificAssets': {},
                   'loadingScreen': {'backgroundColor': 0, 'backgroundFadeInDuration': 0.2,
                                     'backgroundImageResourceName': '', 'gdevelopLogoStyle': 'light',
                                     'logoAndProgressFadeInDuration': 0.2, 'logoAndProgressLogoFadeInDelay': 0,
                                     'minDuration': 0, 'progressBarColor': 16777215, 'progressBarHeight': 20,
                                     'progressBarMaxWidth': 200, 'progressBarMinWidth': 40,
                                     'progressBarWidthPercent': 30, 'showGDevelopSplash': False, 'showProgressBar': True},
                   'watermark': {'placement': 'bottom-left', 'showWatermark': False},
                   'authorIds': [], 'authorUsernames': [], 'categories': [], 'playableDevices': [],
                   'extensionProperties': [], 'platforms': [{'name': 'GDevelop JS platform'}],
                   'currentPlatform': 'GDevelop JS platform'},
    'resources': {'resources': resources, 'resourceFolders': []},
    'objects': [], 'objectsFolderStructure': {'folderName': '__ROOT'}, 'objectsGroups': [],
    'variables': [num('Coins', 0)],
    'layouts': layouts, 'externalEvents': [], 'eventsFunctionsExtensions': [], 'externalLayouts': [],
}
with open(os.path.join(HERE, 'game.json'), 'w') as f:
    json.dump(project, f, indent=2)
print('wrote', len(layouts), 'levels,', sum(len(l['instances']) for l in layouts), 'instances')
