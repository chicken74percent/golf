from cmu_graphics import *
from cmu_graphics import rounded
from cmu_graphics import Sound
import time

#demo video link:
#https://youtu.be/7o2HCYIfmC8

def onAppStart(app):
    #start pg
    app.page = 'startpage'
    app.buttonDefaultSize = (120, 50)
    app.buttonExpandedSize = (140, 60)
    app.mouseX = 0
    app.mouseY = 0

    #levels pg
    app.rows = 3
    app.cols = 4
    app.levels = [[(r * app.cols + c + 1) for c in range(app.cols)] 
                  for r in range(app.rows)]
    app.unlockedLevels = 12
    app.levelButton = (50, 50)
    app.levelButtonGap = 20

    #game pg basics
    app.strokes = 0
    app.currentLevel = 1

    #sounds
    app.backgroundMusic = Sound('BGM.mp3')
    app.backgroundMusic.setVolume(0.6)
    app.backgroundMusic.play(loop = True)
    app.golfHitSound = Sound('GolfHit.mp3')
    app.wallHitSound = Sound('WallHit.mp3')
    app.winSound = Sound('WinSound.mp3')
    app.winSound.setVolume(0.6)
    app.failSound = Sound('Fail.mp3')

    app.winSoundPlayed = False

    #timed
    app.levelStartTime = None
    app.timeLimit = None
    app.timeLeft = None
    app.fail = False
    app.failFade = 0

    #Levels data
    app.levelData = {
        1: {
            'courseMap': [
                (85, 90), (85, 255), (130, 305), (130, 330),
                (250, 330), (250, 280), (325, 280), (325, 120),
                (250, 120), (250, 90)
            ],
            'ballCenter': (230, 310),
            'holeCenter': (300, 250),
            'innerWalls': [],
            'timeLimit': 20
        },
        2: {
            'courseMap': [
                (100, 200), (200, 100), (300, 200), (200, 300)
            ],
            'ballCenter': (110, 200),
            'holeCenter': (285, 200),
            'innerWalls': [
                (170, 170, 230, 170),
                (230, 170, 230, 230),
                (230, 230, 170, 230),
                (170, 230, 170, 170)
            ],
            'timeLimit': 20
        },
        3: {
            'courseMap': [
                (80, 320), (80, 250), (160, 250),
                (160, 180), (240, 180), (240, 110),
                (320, 110), (320, 320)
            ],
            'ballCenter': (100, 300),
            'holeCenter': (300, 130),
            'innerWalls': [
                (260, 200, 290, 150), 
                (220, 230, 300, 260), 
                (190, 220, 210, 300)
            ],
            'timeLimit': 25
        },
        4: {
            'courseMap': [
                (100, 300), (100, 100), (300, 100), (300, 200),
                (200, 200), (200, 300)
            ],
            'ballCenter': (120, 280),
            'holeCenter': (280, 120),
            'innerWalls': [
                (160, 190, 250, 175),
                (120, 180, 250, 120),
                (275, 190, 250, 140),
                (120, 230, 180, 240)
            ],
            'timeLimit': 20
        },
        5: {
            'courseMap': [
                (100, 300), (100, 100), (300, 100), (300, 300)
            ],
            'ballCenter': (120, 280),
            'holeCenter': (280, 120),
            'innerWalls': [
                (170, 200, 230, 200),
                (170, 200, 170, 270),
                (230, 200, 230, 115),

                (130, 130, 190, 180),

                (200, 250, 250, 270),

                (140, 260, 160, 290),

                (260, 140, 280, 250)
            ],
            'timeLimit': 25
        },
        6: {
            'courseMap': [
                (100, 100), (300, 100), (300, 300), (100, 300)
            ],
            'ballCenter': (120, 280),
            'holeCenter': (280, 120),
            'innerWalls': [],
            'bounceCircle': {
                'center': (200, 200),
                'radius': 50,
                'color': 'khaki'
            },
            'timeLimit': 12
        },
        7: {
            'courseMap': [
                (120, 80), (280, 80), (340, 160), (320, 300),
                (200, 340), (100, 260), (80, 180)
            ],
            'ballCenter': (130, 250),
            'holeCenter': (280, 120),
            'innerWalls': [],
            'bounceCircle': [
                { 'center': (180, 160), 'radius': 60, 'color': 'khaki' },
                { 'center': (250, 260), 'radius': 50, 'color': 'khaki' } 
            ],
            'timeLimit': 15
        },
        8: {
            'courseMap': [
                (150, 80), (250, 80), (320, 150), (320, 250),
                (250, 320), (150, 320), (80, 250), (80, 150)
            ],
            'ballCenter': (95, 215),
            'holeCenter': (290, 145),
            'innerWalls': [
                (150, 180, 100, 170),
                (250, 230, 300, 200),
                (200, 255, 200, 300),
                (200, 100, 200, 140)
            ],
            'bounceCircle': {
                'center': (200, 200),
                'radius': 45,
                'color': 'khaki'
            },
            'timeLimit': 20
        },
        9: {
            'courseMap': [
                (80, 100), (120, 100), (160, 130), (190, 110),
                (220, 210), (250, 130), (280, 160), (300, 140),
                (320, 180), (310, 220), (270, 190), (230, 240),
                (200, 250), (120, 160), (140, 150), (110, 270),
                (90, 240)
            ],
            'ballCenter': (100, 200),
            'holeCenter': (290, 180),
            'innerWalls': [
                (200, 210, 160, 150),
            ],
            'timeLimit': 25
        },
        10: {
            'courseMap': [
                (80, 150), (110, 120), (150, 100), (200, 130),
                (250, 110), (290, 140), (310, 180), (280, 220),
                (240, 250), (200, 230), (160, 260), (120, 240),
                (90, 200)
            ],
            'ballCenter': (100, 160),
            'holeCenter': (260, 200),
            'innerWalls': [
                (220, 130, 230, 200),
                (200, 150, 180, 240)
            ],
            'bounceCircle': {
                'center': (150, 160),
                'radius': 30,
                'color': 'khaki'
            },
            'timeLimit': 25
        },
        11: {
            'courseMap': [
                (100, 300), (80, 220), (120, 140), (160, 100), (220, 110),
                (300, 150), (350, 200), (330, 260), (280, 310), (200, 330),
                (130, 320)
            ],
            'ballCenter': (110, 290),
            'holeCenter': (310, 180),
            'innerWalls': [
                (280, 140, 280, 200),
                (300, 200, 290, 300),
                (260, 240, 295, 240)
            ],
            'bounceCircle': [
                { 'center': (155, 170), 'radius': 35, 'color': 'khaki' },
                { 'center': (210, 255), 'radius': 45, 'color': 'khaki' },
                { 'center': (230, 170), 'radius': 30, 'color': 'khaki' }
            ],
            'timeLimit': 30
        },
        12: {
            'courseMap': [
                (100, 100), (300, 100), (300, 300), (100, 300)
            ],
            'ballCenter': (120, 280),
            'holeCenter': (280, 120),
            'innerWalls': [],
            'bounceCircle': {
                'center': (200, 200),
                'radius': 89.2,
                'color': 'khaki'
            },
            'timeLimit': 50
        }
    }

    levelInfo = app.levelData[app.currentLevel]
    app.courseMap = levelInfo['courseMap']
    app.innerWalls = levelInfo['innerWalls']
    app.ballCenter = levelInfo['ballCenter']
    app.holeCenter = levelInfo['holeCenter']
    app.holeRadius = 7

    #ball
    app.ballRadius = 5
    app.ballCenter = (230, 310)
    app.ballX, app.ballY = app.ballCenter
    app.ballVx = 0
    app.ballVy = 0

    app.trailCounter = 0
    app.trailInterval = 20
    app.ballTrail = []
    app.ballTrailLength = 20

    #dragging ball
    app.dragging = False
    app.dragStart = None
    app.maxDragDistance = 60

    #win detection
    app.win = False
    app.fadeOpacity = 0

    resetBall(app)

def resetBall(app):
    app.ballX, app.ballY = app.ballCenter
    app.ballVx = 0
    app.ballVy = 0
    app.strokes = 0
    app.winSoundPlayed = False
    app.dragging = False
    app.dragStart = None
    app.fadeOpacity = 0
    app.failFade = 0

def loadLevel(app, levelNum):
    app.currentLevel = levelNum
    levelInfo = app.levelData[levelNum]
    app.courseMap = levelInfo['courseMap']
    app.innerWalls = levelInfo['innerWalls']
    app.ballCenter = levelInfo['ballCenter']
    app.holeCenter = levelInfo['holeCenter']
    app.timeLimit = levelInfo.get('timeLimit')
    app.timeLeft = app.timeLimit
    app.levelStartTime = time.time()
    resetBall(app)
    app.win = False
    app.fail = False
    app.fadeOpacity = 0
    app.failFade = 0

def redrawAll(app):
    if app.page == 'startpage':
        startPage(app)
    elif app.page == 'levels':
        levelsPage(app)
    elif app.page == 'gamepage':
        gamePage(app)
        if app.win:
            drawRect(0, 0, app.width, app.height, 
                     fill = 'white', opacity = app.fadeOpacity)
        if app.fail:
            drawRect(0, 0, app.width, app.height, 
                     fill = 'white', opacity = app.failFade)
    elif app.page == 'winpage':
        winpage(app)
    elif app.page == 'failpage':
        failpage(app)

def levelsPage(app):
    drawRect(0, 0, app.width, app.height, fill = 'steelBlue')
    drawLabel('Level Selection', app.width / 2, 40, size = 40, bold = True,
              fill = 'white', border = 'black')

    buttonWidth, buttonHeight = app.levelButton
    gap = app.levelButtonGap


    selectionGridWidth = app.cols * buttonWidth + (app.cols - 1) * gap
    selectionGridHeight = app.rows * buttonHeight + (app.rows - 1) * gap

    startX = (app.width - selectionGridWidth) / 2
    startY = (app.height - selectionGridHeight) / 2

    for row in range (app.rows):
        for col in range(app.cols):
            level = app.levels[row][col]

            x = startX + col * (buttonWidth + gap)
            y = startY + row * (buttonHeight + gap)

            centerX = x + buttonWidth / 2
            centerY = y + buttonHeight / 2

            inButton = mouseInLevel(app, x, y, 
                                   buttonWidth, buttonHeight)
            
            fill = 'black' if inButton else 'lightGray'

            drawRect(centerX, centerY, buttonWidth, buttonHeight, 
                    fill = 'lightBlue', border = fill, 
                    borderWidth = 3, align = 'center')
            
            textSize = int(buttonHeight * 0.5)
            fillColor = 'black' if level <= app.unlockedLevels else 'gray'
            drawLabel(str(level), x + buttonWidth / 2, y + buttonHeight / 2,
                      size = textSize, bold = True, fill = fillColor, 
                      align = 'center')
            
    back = mouseInLevel(app, 20, app.height - 50, 80, 30)
    if back:
        drawRect(60, app.height - 35, 90, 40, align = 'center', 
                         fill = 'lightBlue', border = 'black', borderWidth = 3)
        drawLabel('Back', 60, app.height - 35, size = 20, bold = True)
    else:
        drawRect(60, app.height - 35, 90, 40, align = 'center', 
                         fill = 'lightGray', border = 'black', borderWidth = 3)
        drawLabel('Back', 60, app.height - 35, size = 20, bold = True)

def startPage(app):
    drawImage('Picture.jpg', 0, 0, width=400, height=400)
    drawLabel('Golf 112!', app.width/2, app.height/2 - 90, 
              size = 60, bold = True, fill = 'white', border = 'black')
    
    inButton = mouseInRect(app, app.mouseX, app.mouseY)
    if inButton:
        width, height = app.buttonExpandedSize  
    else: 
        width, height = app.buttonDefaultSize

    drawRect(app.width / 2, app.height / 2 + 60,
             width, height, fill = 'lightBlue', border = 'black', 
             borderWidth = 3, align = 'center')
    
    txtSize = height * 0.5
    drawLabel('Levels', app.width / 2, app.height / 2 + 60, size = txtSize, 
              bold = True, fill = 'black', align = 'center')
    
def gamePage(app):
    drawRect(0, 0, app.width, app.height, fill = 'silver')

    drawLabel(f'Level: {app.currentLevel}', 20, 
              20, size = 13, bold = True, align = 'left')
    drawLabel(f'Strokes: {app.strokes}', 20,
              40, size = 13, bold = True, align = 'left')
    
    homeButton = mouseInLevel(app, 20, app.height - 70, 60, 25)
    if homeButton:
        drawRect(50, app.height - 58, 60, 25, align = 'center',
                fill = 'lightBlue', border = 'black', borderWidth = 3)
    else:
        drawRect(50, app.height - 58, 60, 25, align = 'center',
                fill = 'lightGray', border='black', borderWidth=3)
    drawLabel('Home', 50, app.height - 58, size = 14, bold = True)

    levelButton = mouseInLevel(app, 20, app.height - 38, 60, 25)
    if levelButton:
        drawRect(50, app.height - 26, 60, 25, align = 'center',
                fill = 'lightBlue', border = 'black', borderWidth=3)
    else:
        drawRect(50, app.height - 26, 60, 25, align='center',
                fill = 'lightGray', border = 'black', borderWidth=3)
    drawLabel('Levels', 50, app.height - 26, size = 14, bold = True)
    #map
    drawPolygon(*sum(app.courseMap, ()), 
                fill = 'green', border = 'white', borderWidth = 3)
    #walls
    for wall in app.innerWalls:
        x1, y1, x2, y2 = wall
        drawLine(x1, y1, x2, y2, fill = 'white', lineWidth = 3)
    #hole
    drawCircle(app.holeCenter[0], app.holeCenter[1],
               app.holeRadius, fill = 'black')
    #ball trail
    for i in range(len(app.ballTrail)):
        x, y = app.ballTrail[i]
        opacity = int(100 * (i / app.ballTrailLength))
        drawCircle(x, y, app.ballRadius - 1, fill = 'darkGreen', opacity = opacity)
    #ball
    drawCircle(app.ballX, app.ballY, app.ballRadius,
               fill = 'white', border = 'black')
    #dragging ball
    powerBarX = 30
    powerBarY = 140
    powerBarWidth = 20
    powerBarHeight = 120

    drawRect(powerBarX, powerBarY, powerBarWidth, powerBarHeight,
            fill = None, border = 'black')
    
    if 'bounceCircle' in app.levelData[app.currentLevel]:
        bounce = app.levelData[app.currentLevel]['bounceCircle']
        if isinstance(bounce, dict):
            bounce = [bounce]
        for b in bounce:
            cx, cy = b['center']
            r = b['radius']
            color = b.get('color', 'yellow')
            drawCircle(cx, cy, r, fill=color, border='black')
            
            arrowLength = r * 0.5
            drawLine(cx - arrowLength, cy - arrowLength, cx + arrowLength, cy + arrowLength,
                    fill = 'gray', lineWidth = 2, arrowStart = True, arrowEnd = True)

            drawLine(cx + arrowLength, cy - arrowLength, cx - arrowLength, cy + arrowLength,
                    fill = 'gray', lineWidth = 2, arrowStart = True, arrowEnd = True)


    powerRatio = 0
    if app.dragging:
        dx = app.mouseX - app.ballX
        dy = app.mouseY - app.ballY
        distance = (dx ** 2 + dy ** 2) ** 0.5

        if distance > app.maxDragDistance:
            scale = app.maxDragDistance / distance
            dx *= scale
            dy *= scale
            distance = app.maxDragDistance
        powerRatio = distance / app.maxDragDistance

        tipX = app.ballX + dx
        tipY = app.ballY + dy

        drawLine(app.ballX, app.ballY, tipX, tipY,
                fill='white', lineWidth=2, arrowEnd=True)

    filledHeight = powerBarHeight * powerRatio
    red = 255
    green = int(255 * (1 - powerRatio))
    blue = int(255 * (1 - powerRatio))
    color = rgb(red, green, blue)

    if filledHeight > 0:
        drawRect(powerBarX, powerBarY + powerBarHeight - filledHeight,
                powerBarWidth, filledHeight, fill=color, border='black')

    percent = rounded(powerRatio * 100)
    drawLabel(f'{percent}%', powerBarX + powerBarWidth // 2,
            powerBarY + powerBarHeight + 15, size=12, fill='black',
            align='center', bold=True)
    drawLabel('Power:', powerBarX + powerBarWidth // 2,
            powerBarY - 15, size=12, fill='black', align='center', bold=True)

    if app.timeLeft is not None:
        timeDisplay = int(app.timeLeft)
        drawLabel(f'Time: {timeDisplay}s', app.width - 20, 20, size=13,
                bold=True, align='right', fill='black')

def winpage(app):
    drawRect(0, 0, app.width, app.height, fill='white', opacity=app.failFade)
    if app.fadeOpacity < 100:
        return
    drawLabel(f'Completed Level in {app.strokes} strokes!', app.width // 2, 100, size=20, bold=True)

    mx, my = app.mouseX, app.mouseY
    isHoverReplay = (app.width//2 - 60 <= mx <= app.width//2 + 60) and (160 <= my <= 200)
    isHoverNext   = (app.width//2 - 60 <= mx <= app.width//2 + 60) and (210 <= my <= 250)
    isHoverLevels = (app.width//2 - 60 <= mx <= app.width//2 + 60) and (260 <= my <= 300)

    replayColor = 'lightBlue' if isHoverReplay else 'lightGray'
    nextColor   = 'lightBlue' if isHoverNext   else 'lightGray'
    levelsColor = 'lightBlue' if isHoverLevels else 'lightGray'

    drawRect(app.width // 2, 180, 120, 40, fill = replayColor, 
             border = 'black', align = 'center')
    drawLabel('Replay', app.width // 2, 180, size = 14, bold = True)

    drawRect(app.width // 2, 230, 120, 40, fill = nextColor, 
             border = 'black', align = 'center')
    drawLabel('Next Level', app.width // 2, 230, size = 14, bold = True)

    drawRect(app.width // 2, 280, 120, 40, fill = levelsColor, 
             border = 'black', align = 'center')
    drawLabel('Levels', app.width // 2, 280, size = 14, bold = True)

def failpage(app):
    drawRect(0, 0, app.width, app.height, fill='white', opacity=app.failFade)
    if app.failFade < 100:
        return
    
    drawLabel('Time’s up! Try again.', app.width//2, 100, size=20, bold=True)

    mx, my = app.mouseX, app.mouseY
    isHoverReplay = (app.width//2 - 60 <= mx <= app.width//2 + 60) and (160 <= my <= 200)
    isHoverLevels = (app.width//2 - 60 <= mx <= app.width//2 + 60) and (210 <= my <= 250)

    replayColor = 'lightBlue' if isHoverReplay else 'lightGray'
    levelsColor = 'lightBlue' if isHoverLevels else 'lightGray'

    drawRect(app.width//2, 180, 120, 40, fill=replayColor, border='black', align='center')
    drawLabel('Retry', app.width//2, 180, size=14, bold=True)

    drawRect(app.width//2, 230, 120, 40, fill=levelsColor, border='black', align='center')
    drawLabel('Levels', app.width//2, 230, size=14, bold=True)

def mouseInRect(app, x, y):
    buttonX = app.width / 2
    buttonY = app.height / 2 + 60
    width, height = app.buttonExpandedSize
    return (buttonX - width / 2 <= x <= buttonX + width / 2 and
            buttonY - height / 2 <= y <= buttonY + height / 2)

def mouseInLevel(app, x, y, buttonWidth, buttonHeight):
    return (x <= app.mouseX <= x + buttonWidth and
            y <= app.mouseY <= y + buttonHeight)

def onMouseMove(app, mouseX, mouseY):
    app.mouseX = mouseX
    app.mouseY = mouseY

def mouseInBall(app, mouseX, mouseY):
    dx = mouseX - app.ballX
    dy = mouseY - app.ballY
    distance = (dx ** 2 + dy ** 2) ** 0.5
    return distance <= app.ballRadius

def onMousePress(app, mouseX, mouseY):
    if app.page == 'winpage':
        if (app.width // 2 - 60 <= mouseX <= app.width // 2 + 60):
            if 160 <= mouseY <= 200:
                loadLevel(app, app.currentLevel)
                app.page = 'gamepage'
                app.fadeOpacity = 0
                app.win = False

            elif 210 <= mouseY <= 250:
                nextLevel = app.currentLevel + 1
                if nextLevel in app.levelData:
                    loadLevel(app, nextLevel)
                    app.page = 'gamepage'
                    app.fadeOpacity = 0
                    app.win = False

            elif 260 <= mouseY <= 300:
                app.page = 'levels'
                app.fadeOpacity = 0
                app.win = False
        return

    if app.page == 'failpage':
        if app.width // 2 - 60 <= mouseX <= app.width // 2 + 60:
            if 160 <= mouseY <= 200:
                loadLevel(app, app.currentLevel)
                app.page = 'gamepage'
                app.failFade = 0
                app.win = False
            elif 210 <= mouseY <= 250:
                app.page = 'levels'
                app.fail = False
                app.failFade = 0
        return       

    if app.page == 'startpage' and mouseInRect(app, mouseX, mouseY):
        app.page = 'levels'
    
    elif app.page == 'levels':
        width, height = app.levelButton
        gap = app.levelButtonGap
        gridWidth = app.cols * width + (app.cols - 1) * gap
        gridHeight = app.rows * height + (app.rows - 1) * gap
        startX = (app.width - gridWidth) / 2
        startY = (app.height - gridHeight) / 2

        for row in range(app.rows):
            for col in range(app.cols):
                level = app.levels[row][col]
                x = startX + col * (width + gap)
                y = startY + row * (height + gap)

                if mouseInLevel(app, x, y, width, height):
                    if level <= app.unlockedLevels:
                        loadLevel(app, level)
                        app.page = 'gamepage'
                        return
        
        if mouseInLevel(app, 20, app.height - 50, 80, 30):
            app.page = 'startpage'

    elif app.page == 'gamepage':
        homeX = 50
        homeY = app.height - 58
        homeW = 60
        homeH = 25

        levelX = 50
        levelY = app.height - 26
        levelW = 60
        levelH = 25

        if (homeX - homeW / 2 <= mouseX <= homeX + homeW / 2 and
            homeY - homeH / 2 <= mouseY <= homeY + homeH / 2):
            app.page = 'startpage'
            if app.currentLevel == 1:
                resetBall(app)
                app.strokes = 0
                return
        elif (levelX - levelW / 2 <= mouseX <= levelX + levelW / 2 and
              levelY - levelH / 2 <= mouseY <= levelY + levelH / 2):
            app.page = 'levels'
            if app.currentLevel == 1:
                resetBall(app)
                app.strokes = 0
                return
        if (app.ballVx == 0 and app.ballVy == 0 and 
            mouseInBall(app, mouseX, mouseY)):
            app.dragging = True
            app.dragStart = (mouseX, mouseY)

def onMouseDrag(app, mouseX, mouseY):
    if app.page == 'gamepage' and app.dragging:
        dx = app.ballX - mouseX
        dy = app.ballY - mouseY
        distance = (dx ** 2 + dy ** 2) ** 0.5

        if distance > app.maxDragDistance:
            scale = app.maxDragDistance / distance
            dx *= scale
            dy *= scale
        
        app.mouseX = app.ballX + dx
        app.mouseY = app.ballY + dy

def onMouseRelease(app, mouseX, mouseY):
    if app.page == 'gamepage' and app.dragging:
        dx = app.dragStart[0] - mouseX
        dy = app.dragStart[1] - mouseY
        distance = (dx ** 2 + dy ** 2) ** 0.5

        if distance > app.maxDragDistance:
            scale = app.maxDragDistance / distance
            dx *= scale
            dy *= scale
        
        power = 0.1
        app.ballVx = dx * power
        app.ballVy = dy * power

        app.dragging = False
        app.dragStart = None

        if distance > app.maxDragDistance * 0.01:
            app.strokes += 1
            app.golfHitSound.play()

def checkBallCollision(app):
    walls = []
    for i in range(len(app.courseMap)):
        x1, y1 = app.courseMap[i]
        x2, y2 = app.courseMap[(i + 1) % len(app.courseMap)]
        walls.append((x1, y1, x2, y2))
    if hasattr (app, 'innerWalls'):
        walls += app.innerWalls
        
    for _ in range(5):
        for x1, y1, x2, y2 in walls:
            wallDx = x2 - x1
            wallDy = y2 - y1
            px = app.ballX
            py = app.ballY
            length = (wallDx ** 2 + wallDy ** 2) ** 0.5
            if length == 0:
                continue

#The below part was done with some help from chatgpt. I was originally going to make 
#the bounce function based off of linear algebra (which I consulted chatgpt
#for some of the collision codes for it because last time I got in touch with linear
# algebra was in high school senior semester 1), but I kept having troubles with keeping 
#the ball inside the walls while I loop through the different points in map--the ball 
#fails to detect the intersection point of 2 walls or more complicated map shapes
#from time to time and goes though the map, so I decided to switch to an easier version
#of the collision detection which is to check the distance between the ball and the walls and 
#directly bounce the ball off the wall if it is too close to the wall. (so basically a much 
#simplified version of the chat-gpt inspired code). 

            wallDx /= length
            wallDy /= length

            toBallX = px - x1
            toBallY = py - y1

            projLength = toBallX * wallDx + toBallY * wallDy
            projLength = max(0, min(length, projLength))

            closestX = x1 + wallDx * projLength
            closestY = y1 + wallDy * projLength

            dx = px - closestX
            dy = py - closestY
            distance = (dx ** 2 + dy ** 2) ** 0.5

            if distance < app.ballRadius:
                app.wallHitSound.play()
                if abs(wallDx) > abs(wallDy):
                    app.ballVy = -app.ballVy
                else:
                    app.ballVx = -app.ballVx
                
                overlap = app.ballRadius - distance + 0.2
                norm = (dx ** 2 + dy ** 2) ** 0.5
                if norm != 0:
                    app.ballX += (dx / norm) * overlap
                    app.ballY += (dy / norm) * overlap

def clampBallInMap(app):
    r = app.ballRadius + 1
    app.ballX = min(max(app.ballX, r), app.width - r)
    app.ballY = min(max(app.ballY, r), app.height - r)

def checkBallInHole(app):
    dx = app.ballX - app.holeCenter[0]
    dy = app.ballY - app.holeCenter[1]
    distance = (dx**2 + dy**2)**0.5
    return distance <= (app.holeRadius - app.ballRadius)

def onStep(app):
    if app.page == 'gamepage' and not app.win and not app.fail:
        steps = 50
        for x in range(steps):
            app.ballX += app.ballVx / steps
            app.ballY += app.ballVy / steps

            app.trailCounter += 1
            if app.trailCounter % app.trailInterval == 0:
                app.ballTrail.append((app.ballX, app.ballY))
                if len(app.ballTrail) > app.ballTrailLength:
                    app.ballTrail.pop(0)

            checkBallCollision(app)
            clampBallInMap(app)
            checkBounceCircleCollision(app)

        friction = 0.96
        app.ballVx *= friction
        app.ballVy *= friction

        if abs(app.ballVx) < 0.05 and abs(app.ballVy) < 0.05:
            app.ballVx = 0
            app.ballVy = 0

        if not isPointInPolygon(app.ballX, app.ballY, app.courseMap):
            resetBall(app)

        if checkBallInHole(app):
            app.win = True
            if not app.winSoundPlayed:
                app.winSound.play()
                app.winSoundPlayed = True
            if ((app.currentLevel == app.unlockedLevels) and 
                    (app.unlockedLevels < len(app.levelData))):
                app.unlockedLevels += 1
        
        if app.timeLimit != None:
            timeElapsed = time.time() - app.levelStartTime
            app.timeLeft = app.timeLimit - timeElapsed
            if app.timeLeft <= 0:
                app.fail = True
                app.timeLeft = 0
                app.failSound.play()


    if app.win and app.fadeOpacity < 120:
        app.fadeOpacity = min(app.fadeOpacity + 5, 100)
        if app.fadeOpacity >= 100:
            app.page = 'winpage'
    
    if app.fail and app.failFade < 120:
        app.failFade = min(app.failFade + 5, 100)
        if app.failFade >= 100:
            app.page = 'failpage'

def checkBounceCircleCollision(app):
    level = app.levelData[app.currentLevel]
    if 'bounceCircle' not in level:
        return
    
    bounces = level['bounceCircle']
    if isinstance(bounces, dict):
        bounces = [bounces]
    for b in bounces:
        cx, cy = b['center']
        r = b['radius']

        dx = app.ballX - cx
        dy = app.ballY - cy
        distance = (dx ** 2 + dy ** 2) ** 0.5

        if distance < r + app.ballRadius:
            if distance == 0:
                return
            nx = dx / distance
            ny = dy / distance

            dot = app.ballVx * nx + app.ballVy * ny
            app.ballVx -= 2 * dot * nx
            app.ballVy -= 2 * dot * ny

            app.wallHitSound.play()

            app.ballVx *= 1.5
            app.ballVy *= 1.5

            overlap = r + app.ballRadius - distance + 0.1
            app.ballX += nx * overlap
            app.ballY += ny * overlap

def isPointInPolygon(px, py, polygon):
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-10) + xi):
            inside = not inside
        j = i
    return inside

runApp(width=400, height=400)
        