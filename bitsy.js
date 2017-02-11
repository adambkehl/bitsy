/*
	Hi! If you can see this, that means your browser doesn't support
	downloading your bitsy game directly.

	Don't panic!

	All you need to do now is save this page as an ".html" file.
	You should be able to use cmd-s or ctrl-s to save. Then
	you may be given multiple download formats; if so, pick
	"page source" or the closest looking thing.

	The most important thing is when you save, you name the file
	"mygame.html" or something similar. Your browser may ask
	to append ".txt" or something, but don't do that. It should
	end in ".html" so your computer knows it's a webpage. 

	Now you should be able to click on your game and play it 
	in your browser!

	- adam
*/

var xhr;
var canvas;
var context;
var ctx;

var title = "";
var room = {};
var tile = {};
var sprite = {};
var dialog = {};
var palette = {
	"0" : [[0,0,0],[255,0,0],[255,255,255]] //start off with a default palette (can be overriden)
};

//stores all image data for tiles, sprites, drawings
var imageStore = {
	source: {},
	render: {}
};

var spriteStartLocations = {};

/* VERSION */
var version = {
	major: 2,
	minor: 1
};
function getEngineVersion() {
	return version.major + "." + version.minor;
}

/* FLAGS */
var flags = {
	ROOM_FORMAT : 0 // 0 = non-comma separated, 1 = comma separated
};
function resetFlags() {
	flags.ROOM_FORMAT = 0; // default is original format
}

function clearGameData() {
	title = "";
	room = {};
	tile = {};
	sprite = {};
	dialog = {};
	palette = {
		"0" : [[0,0,0],[255,0,0],[255,255,255]] //start off with a default palette (can be overriden)
	};

	//stores all image data for tiles, sprites, drawings
	imageStore = {
		source: {},
		render: {}
	};

	spriteStartLocations = {};
}

var width = 128;
var height = 128;
var scale = 4; //this is stupid but necessary
var tilesize = 8;
var mapsize = 16;

var curRoom = "0";

var key = {
	left : 37,
	right : 39,
	up : 38,
	down : 40,
	space : 32,
	enter : 13,
	w : 87,
	a : 65,
	s : 83,
	d : 68
};

var prevTime = 0;
var deltaTime = 0;

//methods used to trigger gif recording
var didPlayerMoveThisFrame = false;
var onPlayerMoved = null;
var didDialogUpdateThisFrame = false;
var onDialogUpdate = null;

//only used by games exported from the editor
var exportedGameData = "@@D";
function startExportedGame() {
	canvas = document.getElementById("game");
	canvas.width = width * scale;
	canvas.height = width * scale;
	ctx = canvas.getContext("2d");
	load_game(exportedGameData);
}

function getGameNameFromURL() {
	var game = window.location.hash.substring(1);
	console.log("game name --- " + game);
	return game;
}

function load_game(game_data) {
	parseWorld(game_data);
	renderImages();
	onready();
}

var update_interval = null;
function onready() {
	clearInterval(loading_interval);

	document.addEventListener('keydown', onkeydown);
	canvas.addEventListener("mousedown", onTouch);
	console.log("hello");
	update_interval = setInterval(update,-1);

	isTitle = true;
	startDialog(title);
}

function onTouch(e) {
	//dialog mode
	if (isDialogMode) {

		if (isDialogReadyToContinue) {
			continueDialog();
		}
		else {
			skipDialog();
		}

		return;
	}

	//walking mode
	var off = getOffset(e);
	var x = Math.floor(off.x / (tilesize*scale));
	var y = Math.floor(off.y / (tilesize*scale));
	
	//abort if you touch the square you're already on
	if (player().x == x && player().y == y) {
		return;
	}

	//did we touch a sprite?
	var touchedSprite = null;
	for (id in sprite) {
		var spr = sprite[id];
		if (spr.room === curRoom) {
			if (spr.x == x && spr.y == y) {
				touchedSprite = id;
			}
		}
	}

	//respond to sprite touch
	if (touchedSprite) {
		var spr = sprite[touchedSprite];
		console.log(Math.abs(player().x - spr.x));
		console.log(Math.abs(player().y - spr.y));
		if ( Math.abs(player().x - spr.x) == 0
				&& Math.abs(player().y - spr.y) == 1 )
		{
			//touched a sprite next to you
		}
		else if ( Math.abs(player().y - spr.y) == 0
				&& Math.abs(player().x - spr.x) == 1 )
		{
			//touched a sprite next to you
		}
		else
		{
			return; //oh no! touched a sprite that's out of range
		}

		if (dialog[touchedSprite]) {
			console.log()
			startDialog( dialog[touchedSprite] );
		}

		return;
	}

	//did we touch an open square?
	var row = room[curRoom].tilemap[y];
	var til = row.charAt(x);
	if ( room[curRoom].walls.indexOf(til) != -1 ) {
		//touched a wall
		return;
	}

	//find path to open square, if there is one
	var map = collisionMap(curRoom);
	var path = breadthFirstSearch( map, {x:player().x, y:player().y}, {x:x,y:y} );
	path = path.slice(1); //remove player's start square

	//console.log( pathToString(path) );

	player().walkingPath = path;
}

function breadthFirstSearch(map, from, to) {
	from.trail = [];
	var visited = [];
	var queue = [from];
	visited.push( posToString(from) );

	//console.log( "~ bfs ~");
	//console.log( posToString(from) + " to " + posToString(to) );

	while ( queue.length > 0 ) {

		//grab pos from queue and mark as visited
		var curPos = queue.shift();

		//console.log( posToString(curPos) );
		//console.log( ".. " + pathToString(curPos.trail) );
		//console.log( visited );

		if (curPos.x == to.x && curPos.y == to.y) {
			//found a path!
			var path = curPos.trail.splice(0);
			path.push( curPos );
			return path;
		}

		//look at neighbors
		neighbors(curPos).forEach( function(n) {
			var inBounds = (n.x >= 0 && n.x < 16 && n.y >= 0 && n.y < 16);
			if (inBounds) {
				var noCollision = map[n.y][n.x] <= 0;
				var notVisited = visited.indexOf( posToString(n) ) == -1;
				if (noCollision && notVisited) {
					n.trail = curPos.trail.slice();
					n.trail.push(curPos);
					queue.push( n );
					visited.push( posToString(n) );
				}
			}
		});

	}

	return []; // no path found
}

function posToString(pos) {
	return pos.x + "," + pos.y;
}

function pathToString(path) {
	var s = "";
	for (i in path) {
		s += posToString(path[i]) + " ";
	}
	return s;
}

function neighbors(pos) {
	var neighborList = [];
	neighborList.push( {x:pos.x+1, y:pos.y+0} );
	neighborList.push( {x:pos.x-1, y:pos.y+0} );
	neighborList.push( {x:pos.x+0, y:pos.y+1} );
	neighborList.push( {x:pos.x+0, y:pos.y-1} );
	return neighborList;
}

function collisionMap(roomId) {
	var map = [
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
	];

	for (r in room[roomId].tilemap) {
		var row = room[roomId].tilemap[r];
		for (var c = 0; c < row.length; c++) {
			if (room[roomId].walls.indexOf( row.charAt(c) ) != -1) {
				map[r][c] = 1;
			}
		}
	}

	for (id in sprite) {
		var spr = sprite[id];
		if (spr.room === roomId) {
			map[spr.y][spr.x] = 2;
		}
	}

	return map;
}

//from stack overflow (I know *gasp*)
function getOffset(evt) {
	var el = evt.target,
	  x = 0,
	  y = 0;

	while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
	x += el.offsetLeft - el.scrollLeft;
	y += el.offsetTop - el.scrollTop;
	el = el.offsetParent;
	}

	x = evt.clientX - x;
	y = evt.clientY - y;

	return { x: x, y: y };
}

function stopGame() {
	document.removeEventListener('keydown', onkeydown);
	clearInterval(update_interval);
}

/* loading animation */
var loading_anim_data = [
	[
		0,1,1,1,1,1,1,0,
		0,0,1,1,1,1,0,0,
		0,0,1,1,1,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,0,0,1,0,0,
		0,0,1,0,0,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,1,1,1,1,1,1,0,
		0,0,1,0,0,1,0,0,
		0,0,1,1,1,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,0,0,1,0,0,
		0,0,1,1,1,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,1,1,1,1,1,1,0,
		0,0,1,0,0,1,0,0,
		0,0,1,0,0,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,1,1,1,0,0,
		0,0,1,1,1,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,1,1,1,1,1,1,0,
		0,0,1,0,0,1,0,0,
		0,0,1,0,0,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,1,1,1,0,0,
		0,0,1,1,1,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,0,0,0,0,0,0,0,
		1,0,0,0,0,0,0,1,
		1,1,1,0,0,1,1,1,
		1,1,1,1,1,0,0,1,
		1,1,1,1,1,0,0,1,
		1,1,1,0,0,1,1,1,
		1,0,0,0,0,0,0,1,
		0,0,0,0,0,0,0,0,
	]
];
var loading_anim_frame = 0;
var loading_anim_speed = 500;
var loading_interval = null;

function loadingAnimation() {
	//create image
	var loadingAnimImg = ctx.createImageData(8*scale, 8*scale);
	//draw image
	for (var y = 0; y < 8; y++) {
		for (var x = 0; x < 8; x++) {
			var i = (y * 8) + x;
			if (loading_anim_data[loading_anim_frame][i] == 1) {
				//scaling nonsense
				for (var sy = 0; sy < scale; sy++) {
					for (var sx = 0; sx < scale; sx++) {
						var pxl = 4 * ( (((y*scale)+sy) * (8*scale)) + ((x*scale)+sx) );
						loadingAnimImg.data[pxl+0] = 255;
						loadingAnimImg.data[pxl+1] = 255;
						loadingAnimImg.data[pxl+2] = 255;
						loadingAnimImg.data[pxl+3] = 255;
					}
				}
			}
		}
	}
	//put image on canvas
	ctx.putImageData(loadingAnimImg,scale*(width/2 - 4),scale*(height/2 - 4));
	//update frame
	loading_anim_frame++;
	if (loading_anim_frame >= 5) loading_anim_frame = 0;
	console.log(loading_anim_frame);
}

function update() {
	var curTime = Date.now();
	deltaTime = curTime - prevTime;
	
	//clear screen
	ctx.fillStyle = "rgb("+palette[curPal()][0][0]+","+palette[curPal()][0][1]+","+palette[curPal()][0][2]+")";
	ctx.fillRect(0,0,canvas.width,canvas.height);
	
	if (!isTitle) {
		updateAnimation();
		drawRoom( room[curRoom] ); // draw world if game has begun
	}

	if (isDialogMode) { // dialog mode
		updateDialog();
		drawDialogBox();
	}
	else {
		moveSprites();

		if (player().walkingPath.length > 0) {
			var dest = player().walkingPath[ player().walkingPath.length - 1 ];
			ctx.fillStyle = "#fff";
			ctx.globalAlpha = 0.5;
			ctx.fillRect( dest.x * tilesize*scale, dest.y * tilesize*scale, tilesize*scale, tilesize*scale );
			ctx.globalAlpha = 1;
		}
	}

	prevTime = curTime;

	//for gif recording
	if (didPlayerMoveThisFrame && onPlayerMoved != null) onPlayerMoved();
	didPlayerMoveThisFrame = false;
	if (didDialogUpdateThisFrame && onDialogUpdate != null) onDialogUpdate();
	didDialogUpdateThisFrame = false;
}

var animationCounter = 0;
var animationTime = 400;
function updateAnimation() {
	animationCounter += deltaTime;

	if ( animationCounter >= animationTime ) {

		// animate sprites
		for (id in sprite) {
			var spr = sprite[id];
			if (spr.animation.isAnimated) {
				spr.animation.frameIndex = ( spr.animation.frameIndex + 1 ) % spr.animation.frameCount;
			}
		}

		// animate tiles
		for (id in tile) {
			var til = tile[id];
			if (til.animation.isAnimated) {
				til.animation.frameIndex = ( til.animation.frameIndex + 1 ) % til.animation.frameCount;
			}
		}

		// reset counter
		animationCounter = 0;

	}
}

var moveCounter = 0;
var moveTime = 200;
function moveSprites() {
	moveCounter += deltaTime;

	if (moveCounter >= moveTime) {

		for (id in sprite) {
			var spr = sprite[id];
			if (spr.walkingPath.length > 0) {
				//move sprite
				var nextPos = spr.walkingPath.shift();
				spr.x = nextPos.x;
				spr.y = nextPos.y;

				//if the sprite hits an exit
				var ext = getExit( spr.room, spr.x, spr.y );
				if (ext) {
					//move it to another scene
					spr.room = ext.dest.room;
					spr.x = ext.dest.x;
					spr.y = ext.dest.y;
					if (id === "A") {
						//if the player changes scenes, change the visible scene
						curRoom = ext.dest.room;
					}
				}

				if (id === "A") didPlayerMoveThisFrame = true;
			}
		}

		moveCounter = 0;
	}

}

function getSpriteAt(x,y) {
	for (id in sprite) {
		var spr = sprite[id];
		if (spr.room === curRoom) {
			if (spr.x == x && spr.y == y) {
				return id;
			}
		}
	}
	return null;
}

function onkeydown(e) {
	console.log(e.keyCode);
	e.preventDefault();

	if (isDialogMode) {

		/* CONTINUE DIALOG */

		if (isDialogReadyToContinue) {
			continueDialog();
		}
		else {
			skipDialog();
		}

	}
	else {

		/* WALK */

		var spr = null;

		if ( (e.keyCode == key.left || e.keyCode == key.a) && !(spr = getSpriteLeft()) && !isWallLeft()) {
			player().x -= 1;
			didPlayerMoveThisFrame = true;
		}
		else if ( (e.keyCode == key.right || e.keyCode == key.d) && !(spr = getSpriteRight()) && !isWallRight()) {
			player().x += 1;
			didPlayerMoveThisFrame = true;
		}
		else if ( (e.keyCode == key.up || e.keyCode == key.w) && !(spr = getSpriteUp()) && !isWallUp()) {
			player().y -= 1;
			didPlayerMoveThisFrame = true;
		}
		else if ( (e.keyCode == key.down || e.keyCode == key.s) && !(spr = getSpriteDown()) && !isWallDown()) {
			player().y += 1;
			didPlayerMoveThisFrame = true;
		}
		
		var ext = getExit( player().room, player().x, player().y );
		if (ext) {
			player().room = ext.dest.room;
			player().x = ext.dest.x;
			player().y = ext.dest.y;
			curRoom = ext.dest.room;
		}
		else if (spr) {
			if (dialog[spr]) {
				startDialog(dialog[spr]);
			}
		}

	}

}

function getSpriteLeft() { //repetitive?
	return getSpriteAt( player().x - 1, player().y );
}

function getSpriteRight() {
	return getSpriteAt( player().x + 1, player().y );
}

function getSpriteUp() {
	return getSpriteAt( player().x, player().y - 1 );
}

function getSpriteDown() {
	return getSpriteAt( player().x, player().y + 1 );
}


function getSpriteAt(x,y) {
	for (s in sprite) {
		if (sprite[s].room === curRoom) {
			if (sprite[s].x == x && sprite[s].y == y) {
				console.log(s);
				return s;
			}
		}
	}
	return null;
}

function isWallLeft() {
	return isWall( player().x - 1, player().y );
}

function isWallRight() {
	return isWall( player().x + 1, player().y );
}

function isWallUp() {
	return isWall( player().x, player().y - 1 );
}

function isWallDown() {
	return isWall( player().x, player().y + 1 );
}

function isWall(x,y) {
	console.log(x + " " + y);
	var i = getRoom().walls.indexOf( getTile(x,y) );
	return i > -1;
}

function getExit(roomId,x,y) {
	for (i in room[roomId].exits) {
		var e = room[roomId].exits[i];
		if (x == e.x && y == e.y) {
			return e;
		}
	}
	return null;
}

function getTile(x,y) {
	console.log(x + " " + y);
	var t = getRoom().tilemap[y][x];
	return t;
}

function player() {
	return sprite["A"];
}

function getRoom() {
	return room[curRoom];
}

function isSpriteOffstage(id) {
	return sprite[id].room == null;
}

function parseWorld(file) {
	resetFlags();

	var lines = file.split("\n");
	var i = 0;
	while (i < lines.length) {
		var curLine = lines[i];

		console.log(lines[i]);

		if (i == 0) {
			i = parseTitle(lines, i);
		}
		else if (curLine.length <= 0 || curLine.charAt(0) === "#") {
			//skip blank lines & comments
			i++;
		}
		else if (getType(curLine) == "PAL") {
			i = parsePalette(lines, i);
		}
		else if (getType(curLine) === "ROOM" || getType(curLine) === "SET") { //SET for back compat
			i = parseRoom(lines, i);
		}
		else if (getType(curLine) === "TIL") {
			i = parseTile(lines, i);
		}
		else if (getType(curLine) === "SPR") {
			i = parseSprite(lines, i);
		}
		else if (getType(curLine) === "DRW") {
			i = parseDrawing(lines, i);
		}
		else if (getType(curLine) === "DLG") {
			i = parseDialog(lines, i);
		}
		else if (getType(curLine) === "!") {
			i = parseFlag(lines, i);
		}
		else {
			i++;
		}
	}
	placeSprites();
	if (player().room != null) {
		curRoom = player().room;
	}
}

//TODO this is in progress and doesn't support all features
function serializeWorld() {
	var worldStr = "";
	/* TITLE */
	worldStr += title + "\n";
	worldStr += "\n";
	/* VERSION */
	worldStr += "# BITSY VERSION " + getEngineVersion() + "\n"; // add version as a comment for debugging purposes
	worldStr += "\n";
	/* FLAGS */
	for (f in flags) {
		worldStr += "! " + f + " " + flags[f] + "\n";
	}
	worldStr += "\n"
	/* PALETTE */
	for (id in palette) {
		worldStr += "PAL " + id + "\n";
		for (i in palette[id]) {
			for (j in palette[id][i]) {
				worldStr += palette[id][i][j];
				if (j < 2) worldStr += ",";
			}
			worldStr += "\n";
		}
		worldStr += "\n";
	}
	/* ROOM */
	for (id in room) {
		worldStr += "ROOM " + id + "\n";
		if ( flags.ROOM_FORMAT == 0 ) {
			// old non-comma separated format
			for (i in room[id].tilemap) {
				for (j in room[id].tilemap[i]) {
					worldStr += room[id].tilemap[i][j];	
				}
				worldStr += "\n";
			}
		}
		else if ( flags.ROOM_FORMAT == 1 ) {
			// new comma separated format
			for (i in room[id].tilemap) {
				for (j in room[id].tilemap[i]) {
					worldStr += room[id].tilemap[i][j];
					if (j < room[id].tilemap[i].length-1) worldStr += ","
				}
				worldStr += "\n";
			}
		}
		if (room[id].walls.length > 0) {
			/* WALLS */
			worldStr += "WAL ";
			for (j in room[id].walls) {
				worldStr += room[id].walls[j];
				if (j < room[id].walls.length-1) {
					worldStr += ",";
				}
			}
			worldStr += "\n";
		}
		if (room[id].exits.length > 0) {
			/* EXITS */
			for (j in room[id].exits) {
				var e = room[id].exits[j];
				if ( isExitValid(e) ) {
					worldStr += "EXT " + e.x + "," + e.y + " " + e.dest.room + " " + e.dest.x + "," + e.dest.y;
					worldStr += "\n";
				}
			}
		}
		worldStr += "\n";
	}
	/* TILES */
	for (id in tile) {
		worldStr += "TIL " + id + "\n";
		for (i in imageStore.source["TIL_" + id]) {
			worldStr += imageStore.source["TIL_" + id][i] + "\n";
		}
		worldStr += "\n";
	}
	/* SPRITES */
	for (id in sprite) {
		worldStr += "SPR " + id + "\n";
		for (i in imageStore.source["SPR_" + id]) {
			worldStr += imageStore.source["SPR_" + id][i] + "\n";
		}
		if (sprite[id].room != null) {
			/* SPRITE POSITION */
			worldStr += "POS " + sprite[id].room + " " + sprite[id].x + "," + sprite[id].y + "\n";
		}
		worldStr += "\n";
	}
	/* DIALOG */
	for (id in dialog) {
		worldStr += "DLG " + id + "\n";
		worldStr += dialog[id] + "\n";
		worldStr += "\n";
	}
	return worldStr;
}

function isExitValid(e) {
	return e.x >= 0 && e.x < 16 && e.y >= 0 && e.y < 16 && 
			e.dest != null && e.dest.room != null &&
			e.dest.x >= 0 && e.dest.x < 16 && e.dest.y >= 0 && e.dest.y < 16;
}

function placeSprites() {
	for (id in spriteStartLocations) {
		//console.log(id);
		//console.log( spriteStartLocations[id] );
		//console.log(sprite[id]);
		sprite[id].room = spriteStartLocations[id].room;
		sprite[id].x = spriteStartLocations[id].x;
		sprite[id].y = spriteStartLocations[id].y;
		//console.log(sprite[id]);
	}
}

function getType(line) {
	return line.split(" ")[0];
}

function getId(line) {
	return line.split(" ")[1];
}

function parseTitle(lines, i) {
	title = lines[i];
	i++;
	return i;
}

function parseRoom(lines, i) {
	var id = getId(lines[i]);
	room[id] = {
		id : id,
		tilemap : [],
		walls : [],
		exits : [],
		pal : null
	};
	i++;

	// create tile map
	if ( flags.ROOM_FORMAT == 0 ) {
		// old way: no commas, single char tile ids
		var end = i + mapsize;
		var y = 0;
		for (; i<end; i++) {
			room[id].tilemap.push( [] );
			for (x = 0; x<mapsize; x++) {
				room[id].tilemap[y].push( lines[i].charAt(x) );
			}
			y++;
		}
	}
	else if ( flags.ROOM_FORMAT == 1 ) {
		// new way: comma separated, multiple char tile ids
		var end = i + mapsize;
		var y = 0;
		for (; i<end; i++) {
			room[id].tilemap.push( [] );
			var lineSep = lines[i].split(",");
			for (x = 0; x<mapsize; x++) {
				room[id].tilemap[y].push( lineSep[x] );
			}
			y++;
		}
	}

	while (i < lines.length && lines[i].length > 0) { //look for empty line
		console.log(getType(lines[i]));
		if (getType(lines[i]) === "SPR") {
			/* NOTE SPRITE START LOCATIONS */
			var sprId = getId(lines[i]);
			if (sprId.indexOf(",") == -1 && lines[i].split(" ").length >= 3) { //second conditional checks for coords
				/* PLACE A SINGLE SPRITE */
				var sprCoord = lines[i].split(" ")[2].split(",");
				spriteStartLocations[sprId] = {
					room : id,
					x : parseInt(sprCoord[0]),
					y : parseInt(sprCoord[1])
				};
			}
			else if ( flags.ROOM_FORMAT == 0 ) { // TODO: right now this shortcut only works w/ the old comma separate format
				/* PLACE MULTIPLE SPRITES*/ 
				//Does find and replace in the tilemap (may be hacky, but its convenient)
				var sprList = sprId.split(",");
				for (row in room[id].tilemap) {
					for (s in sprList) {
						var col = room[id].tilemap[row].indexOf( sprList[s] );
						//if the sprite is in this row, replace it with the "null tile" and set its starting position
						if (col != -1) {
							room[id].tilemap[row] = room[id].tilemap[row].replace( sprList[s], "0" );
							spriteStartLocations[ sprList[s] ] = {
								room : id,
								x : parseInt(col),
								y : parseInt(row)
							};
						}
					}
				}
			}
		}
		else if (getType(lines[i]) === "WAL") {
			/* DEFINE COLLISIONS (WALLS) */
			room[id].walls = getId(lines[i]).split(",");
		}
		else if (getType(lines[i]) === "EXT") {
			/* ADD EXIT */
			var exitArgs = lines[i].split(" ");
			//arg format: EXT 10,5 M 3,2
			var exitCoords = exitArgs[1].split(",");
			var destName = exitArgs[2];
			var destCoords = exitArgs[3].split(",");
			var ext = {
				x : parseInt(exitCoords[0]),
				y : parseInt(exitCoords[1]),
				dest : {
					room : destName,
					x : parseInt(destCoords[0]),
					y : parseInt(destCoords[1])
				}
			};
			room[id].exits.push(ext);
		}
		else if (getType(lines[i]) === "PAL") {
			/* CHOOSE PALETTE (that's not default) */
			room[id].pal = getId(lines[i]);
		}
		i++;
	}
	return i;
}

function parsePalette(lines,i) { //todo this has to go first right now :(
	var id = getId(lines[i]);
	i++;
	var pal = [];
	while (i < lines.length && lines[i].length > 0) { //look for empty line
		var col = [];
		lines[i].split(",").forEach(function(i) {
			col.push(parseInt(i));
		});
		pal.push(col);
		i++;
	}
	palette[id] = pal;
	return i;
}

function parseTile(lines, i) {
	var id = getId(lines[i]);
	var drwId = null;

	i++;

	if (getType(lines[i]) === "DRW") { //load existing drawing
		drwId = getId(lines[i]);
		i++;
	}
	else {
		//store tile source
		// drwId = "TIL_" + id;
		// imageStore.source[drwId] = [];
		// for (var y = 0; y < tilesize; y++) {
		// 	var l = lines[i+y];
		// 	imageStore.source[drwId].push(l);
		// }
		// i = i + tilesize;

		// store tile source (if this works, you need to package it in a function)
		drwId = "TIL_" + id;
		i = parseDrawingCore( lines, i, drwId );
	}

	//other properties
	var colorIndex = 1; //default palette color index is 1
	while (i < lines.length && lines[i].length > 0) { //look for empty line
		if (getType(lines[i]) === "COL") {
			colorIndex = parseInt( getId(lines[i]) );
		}
		i++;
	}

	//tile data
	tile[id] = {
		drw : drwId, //drawing id
		col : colorIndex,
		animation : {
			isAnimated : (imageStore.source[drwId].length > tilesize),
			frameIndex : 0,
			frameCount : 2 // todo: allow more than 2 frames
		}
	};
	return i;
}

function parseSprite(lines, i) {
	var id = getId(lines[i]);
	var drwId = null;

	i++;

	if (getType(lines[i]) === "DRW") { //load existing drawing
		drwId = getId(lines[i]);
		i++;
	}
	else {
		//store sprite source
		// drwId = "SPR_" + id;
		// imageStore.source[drwId] = [];
		// for (var y = 0; y < tilesize; y++) {
		// 	var l = lines[i+y];
		// 	imageStore.source[drwId].push(l);
		// }
		// i = i + tilesize;

		// store sprite source
		drwId = "SPR_" + id;
		i = parseDrawingCore( lines, i, drwId );
	}

	//other properties
	var colorIndex = 2; //default palette color index is 2
	while (i < lines.length && lines[i].length > 0) { //look for empty line
		if (getType(lines[i]) === "COL") {
			/* COLOR OFFSET INDEX */
			colorIndex = parseInt( getId(lines[i]) );
		}
		else if (getType(lines[i]) === "POS") {
			/* STARTING POSITION */
			var posArgs = lines[i].split(" ");
			var roomId = posArgs[1];
			var coordArgs = posArgs[2].split(",");
			spriteStartLocations[id] = {
				room : roomId,
				x : parseInt(coordArgs[0]),
				y : parseInt(coordArgs[1])
			};
		}
		i++;
	}

	//sprite data
	sprite[id] = {
		drw : drwId, //drawing id
		col : colorIndex,
		room : null, //default location is "offstage"
		x : -1,
		y : -1,
		walkingPath : [], //tile by tile movement path (isn't saved)
		animation : {
			isAnimated : (imageStore.source[drwId].length > tilesize),
			frameIndex : 0,
			frameCount : 2 // todo: allow more than 2 frames
		}
	};
	return i;
}

function parseDrawing(lines, i) {
	// var drwId = getId(lines[i]);
	// i++;
	// imageStore.source[drwId] = [];
	// for (var y = 0; y < tilesize; y++) {
	// 	var l = lines[i+y];
	// 	imageStore.source[drwId].push(l);
	// }
	// console.log(drwId);
	// return i + tilesize;

	// store drawing source
	var drwId = getId( lines[i] );
	return parseDrawingCore( lines, i, drwId );
}

function parseDrawingCore(lines, i, drwId) {
	imageStore.source[drwId] = [];
	var y = 0;
	while ( y < tilesize ) {
		var l = lines[i+y];
		imageStore.source[drwId].push(l);
		y++;

		if (y === tilesize) {
			i = i + y;
			if ( lines[i].charAt(0) === ">" ) {
				// there's another animation!
				imageStore.source[drwId].push( lines[i] );
				i++;
				y = 0; //start the count over again for the next frame
			}
		}
	}

	//console.log(imageStore.source[drwId]);
	return i;
}

function renderImages() {
	console.log(" -- RENDER IMAGES -- ");

	//init image store
	for (pal in palette) {
		imageStore.render[pal] = {
			"1" : {}, //images with primary color index 1 (usually tiles)
			"2" : {}  //images with primary color index 2 (usually sprites)
		};
	}

	//render images required by sprites
	for (s in sprite) {
		var spr = sprite[s];
		for (pal in palette) {
			var col = spr.col;
			var colStr = "" + col;
			var rawSrc = imageStore.source[ spr.drw ];
			if ( rawSrc.length === tilesize ) {
				// non-animated drawing
				imageStore.render[pal][colStr][spr.drw] = imageDataFromImageSource( rawSrc, pal, col );
			}
			else {
				// animated drawing
				var frameCount = 0;
				var frameSrc = [];
				for ( l in rawSrc ) {
					if ( rawSrc[l].charAt(0) === ">" ) {
						// end of frame!
						var frameId = spr.drw + "_" + frameCount;
						imageStore.render[pal][colStr][frameId] = imageDataFromImageSource( frameSrc, pal, col );
						frameSrc = [];
						frameCount++;
					}
					else if ( l >= rawSrc.length-1 ) {
						// finish building frame
						frameSrc.push( rawSrc[l] );
						// end of frame!
						var frameId = spr.drw + "_" + frameCount;
						imageStore.render[pal][colStr][frameId] = imageDataFromImageSource( frameSrc, pal, col );
						frameSrc = [];
						frameCount++;
					}
					else {
						// continue building frame
						frameSrc.push( rawSrc[l] );
					}
				}
			}			
		}
	}
	//render images required by tiles (duplicate)
	for (t in tile) {
		var til = tile[t];
		for (pal in palette) {
			var col = til.col;
			var colStr = "" + col;
			var rawSrc = imageStore.source[ til.drw ];
			if ( rawSrc.length === tilesize ) {
				// non-animated drawing
				imageStore.render[pal][colStr][til.drw] = imageDataFromImageSource( rawSrc, pal, col );
			}
			else {
				// animated drawing
				var frameCount = 0;
				var frameSrc = [];
				for ( l in rawSrc ) {
					if ( rawSrc[l].charAt(0) === ">" ) {
						// end of frame!
						var frameId = til.drw + "_" + frameCount;
						imageStore.render[pal][colStr][frameId] = imageDataFromImageSource( frameSrc, pal, col );
						frameSrc = [];
						frameCount++;
					}
					else if ( l >= rawSrc.length-1 ) {
						// finish building frame
						frameSrc.push( rawSrc[l] );
						// end of frame!
						var frameId = til.drw + "_" + frameCount;
						imageStore.render[pal][colStr][frameId] = imageDataFromImageSource( frameSrc, pal, col );
						frameSrc = [];
						frameCount++;
					}
					else {
						// continue building frame
						frameSrc.push( rawSrc[l] );
					}
				}
			}			
		}
	}
}

function imageDataFromImageSource(imageSource, pal, col) {
	//console.log(imageSource);

	var img = ctx.createImageData(tilesize*scale,tilesize*scale);
	for (var y = 0; y < tilesize; y++) {
		for (var x = 0; x < tilesize; x++) {
			var ch = imageSource[y][x];
			for (var sy = 0; sy < scale; sy++) {
				for (var sx = 0; sx < scale; sx++) {
					var pxl = (((y * scale) + sy) * tilesize * scale * 4) + (((x*scale) + sx) * 4);
					if (ch === "1") {
						img.data[pxl + 0] = palette[pal][col][0]; //ugly
						img.data[pxl + 1] = palette[pal][col][1];
						img.data[pxl + 2] = palette[pal][col][2];
						img.data[pxl + 3] = 255;
					}
					else { //ch === "0"
						img.data[pxl + 0] = palette[pal][0][0];
						img.data[pxl + 1] = palette[pal][0][1];
						img.data[pxl + 2] = palette[pal][0][2];
						img.data[pxl + 3] = 255;
					}
				}
			}
		}
	}
	return img;
}

function parseDialog(lines, i) {
	var id = getId(lines[i]);
	i++;
	var text = lines[i];
	i++;
	dialog[id] = text;
	return i;
}

function parseFlag(lines, i) {
	var id = getId(lines[i]);
	var valStr = lines[i].split(" ")[2];
	flags[id] = parseInt( valStr );
	i++;
	return i;
}

function drawTile(img,x,y,context) {
	if (!context) { //optional pass in context; otherwise, use default
		context = ctx;
	}
	context.putImageData(img,x*tilesize*scale,y*tilesize*scale);
}

function drawSprite(img,x,y,context) { //this may differ later
	drawTile(img,x,y,context);
}

function drawRoom(room,context) {
	//draw tiles
	for (i in room.tilemap) {
		for (j in room.tilemap[i]) {
			var id = room.tilemap[i][j];
			if (id != "0") {
				drawTile( getTileImage(tile[id]), j, i, context );
			}
		}
	}
	//draw sprites
	for (id in sprite) {
		var spr = sprite[id];
		if (spr.room === room.id) {
			drawSprite( getSpriteImage(spr), spr.x, spr.y, context );
		}
	}
}

function getTileImage(t,frameIndex) {
	var drwId = t.drw;
	if ( t.animation.isAnimated ) {
		if (frameIndex) { // use optional provided frame index
			drwId += "_" + frameIndex;
		}
		else { // or the one bundled with the tile
			drwId += "_" + t.animation.frameIndex;
		}
	}
	return imageStore.render[curPal()][t.col][drwId];
}

function getSpriteImage(s,frameIndex) {
	var drwId = s.drw;
	if ( s.animation.isAnimated ) {
		if (frameIndex) {
			drwId += "_" + frameIndex;
		}
		else {
			drwId += "_" + s.animation.frameIndex;
		}
	}
	return imageStore.render[curPal()][s.col][drwId];
}

function curPal() {
	//console.log(curRoom);
	//console.log(room[curRoom]);
	if (room[curRoom].pal != null) {
		//a specific palette was chosen
		return room[curRoom].pal;
	}
	else {
		if (curRoom in palette) {
			//there is a palette matching the name of the room
			return curRoom;
		}
		else {
			//use the default palette
			return "0";
		}
	}
}

/* DIALOG */
var dialogbox = {
	img : null,
	width : 104,
	height : 8+4+2+5, //8 for text, 4 for top-bottom padding, 2 for line padding, 5 for arrow
	top : 12,
	left : 12,
	bottom : 12, //for drawing it from the bottom
	charsPerRow : 32
};

var curDialog = [];
var curLine = 0;
var curRow = 0;
var curChar = 0;
var nextCharTimer = 0;
var nextCharMaxTime = 50; //in milliseconds

var isDialogMode = false;
var isTitle = false;
var isDialogReadyToContinue = false;

function clearDialogBox() {
	dialogbox.img = ctx.createImageData(dialogbox.width*scale, dialogbox.height*scale);
}

function drawDialogBox() {
	if (isTitle) {
		ctx.putImageData(dialogbox.img, dialogbox.left*scale, ((height/2)-(dialogbox.height/2))*scale);
	}
	else if (player().y < mapsize/2) {
		//bottom
		ctx.putImageData(dialogbox.img, dialogbox.left*scale, (height-dialogbox.bottom-dialogbox.height)*scale);
	}
	else {
		//top
		ctx.putImageData(dialogbox.img, dialogbox.left*scale, dialogbox.top*scale);
	}
}

function updateDialog() {
	if (isDialogReadyToContinue) {
		return; //waiting for dialog to be advance by player
	}

	nextCharTimer += deltaTime; //tick timer

	if (nextCharTimer > nextCharMaxTime) {
		//time to update characters
		if (curChar + 1 < curDialog[curLine][curRow].length) {
			//add char to current row
			curChar++;
		}
		else if (curRow + 1 < curDialog[curLine].length) {
			//start next row
			curRow++;
			curChar = 0;
		}
		else {
			//the line is full!
			drawNextDialogArrow();
			isDialogReadyToContinue = true;
			didDialogUpdateThisFrame = true;
		}

		drawNextDialogChar();
	}
}

function skipDialog() {
	// add new characters until you get to the end of the current line of dialog
	while ( curRow < curDialog[curLine].length ) {
		if (curChar + 1 < curDialog[curLine][curRow].length) {
			//add char to current row
			curChar++;
		}
		else if (curRow + 1 < curDialog[curLine].length) {
			//start next row
			curRow++;
			curChar = 0;
		}
		else {
			//the line is full!
			drawNextDialogArrow();
			isDialogReadyToContinue = true;
			didDialogUpdateThisFrame = true;
			//make sure to push the curRow past the end to break out of the loop
			curRow++;
			curChar = 0;
		}

		drawNextDialogChar();
	}
}

var arrowdata = [
	1,1,1,1,1,
	0,1,1,1,0,
	0,0,1,0,0
];
function drawNextDialogArrow() {
	console.log("draw arrow!");
	var top = (dialogbox.height-5) * scale;
	var left = (dialogbox.width-(5+4)) * scale;
	for (var y = 0; y < 3; y++) {
		for (var x = 0; x < 5; x++) {
			var i = (y * 5) + x;
			if (arrowdata[i] == 1) {
				//scaling nonsense
				for (var sy = 0; sy < scale; sy++) {
					for (var sx = 0; sx < scale; sx++) {
						var pxl = 4 * ( ((top+(y*scale)+sy) * (dialogbox.width*scale)) + (left+(x*scale)+sx) );
						dialogbox.img.data[pxl+0] = 255;
						dialogbox.img.data[pxl+1] = 255;
						dialogbox.img.data[pxl+2] = 255;
						dialogbox.img.data[pxl+3] = 255;
					}
				}

				
			}
		}
	}
}

function continueDialog() {
	console.log("continue!!!");
	if (curLine + 1 < curDialog.length) {
		//start next line
		isDialogReadyToContinue = false;
		curLine++;
		curRow = 0;
		curChar = 0;
		clearDialogBox();
		drawNextDialogChar();
	}
	else {
		//end dialog mode
		isDialogMode = false;
		onExitDialog();
	}
}

function onExitDialog() {
	if (isTitle) isTitle = false;
}

function drawNextDialogChar() {
	//draw the character
	var nextChar = curDialog[curLine][curRow][curChar];
	drawDialogChar(nextChar, curRow, curChar);

	nextCharTimer = 0; //reset timer
}

var text_scale = 2; //using a different scaling factor for text feels like cheating... but it looks better
function drawDialogChar(char, row, col) {

	var top = (4 * scale) + (row * 2 * scale) + (row * 8 * text_scale);
	var left = (4 * scale) + (col * 6 * text_scale);
	var startIndex = char.charCodeAt(0) * (6*8);
	for (var y = 0; y < 8; y++) {
		for (var x = 0; x < 6; x++) {
			var i = startIndex + (y * 6) + x;
			if (fontdata[i] == 1) {

				//scaling nonsense
				for (var sy = 0; sy < text_scale; sy++) {
					for (var sx = 0; sx < text_scale; sx++) {
						var pxl = 4 * ( ((top+(y*text_scale)+sy) * (dialogbox.width*scale)) + (left+(x*text_scale)+sx) );
						dialogbox.img.data[pxl+0] = 255;
						dialogbox.img.data[pxl+1] = 255;
						dialogbox.img.data[pxl+2] = 255;
						dialogbox.img.data[pxl+3] = 255;
					}
				}

				
			}
		}
	}
}

function startDialog(dialogStr) {

	//process dialog so it's easier to display
	var words = dialogStr.split(" ");
	curDialog = [];
	var curLineArr = [];
	var curRowStr = words[0];

	for (var i = 1; i < words.length; i++) {
		var word = words[i];
		if (curRowStr.length + word.length + 1 <= dialogbox.charsPerRow) {
			//stay on same row
			curRowStr += " " + word;
		}
		else if (curLineArr.length == 0) {
			//start next row
			curLineArr.push(curRowStr);
			curRowStr = word;
		}
		else {
			//start next line
			curLineArr.push(curRowStr);
			curDialog.push(curLineArr);
			curLineArr = [];
			curRowStr = word;
		}
	}

	//finish up 
	if (curRowStr.length > 0) {
		curLineArr.push(curRowStr);
	}
	if (curLineArr.length > 0) {
		curDialog.push(curLineArr);
	}

	console.log(curDialog);

	curLine = 0;
	curRow = 0;
	curChar = 0;

	isDialogMode = true;
	isDialogReadyToContinue = false;

	clearDialogBox();
	drawNextDialogChar();
}

var fontdata = [
		/* num: 0 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 1 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,1,0,1,1,
		0,1,0,0,0,1,
		0,1,0,1,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 2 */
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,1,0,1,0,1,
		0,1,1,1,1,1,
		0,1,0,0,0,1,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 3 */
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,1,1,1,1,1,
		0,1,1,1,1,1,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 4 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,0,1,1,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/*0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,1,0,1,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,*/
		/* num: 5 */
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 6 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 7 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 8 */
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,0,0,1,1,
		1,1,0,0,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 9 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 10 */
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,0,0,0,0,1,
		1,0,1,1,0,1,
		1,0,1,1,0,1,
		1,0,0,0,0,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 11 */
		0,0,0,0,0,0,
		0,0,0,1,1,1,
		0,0,0,0,1,1,
		0,0,1,1,0,1,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 12 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 13 */
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,1,0,1,
		0,0,0,1,0,0,
		0,0,1,1,0,0,
		0,1,1,1,0,0,
		0,1,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 14 */
		0,0,0,0,1,1,
		0,0,1,1,0,1,
		0,0,1,0,1,1,
		0,0,1,1,0,1,
		0,0,1,0,1,1,
		0,1,1,0,1,1,
		0,1,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 15 */
		0,0,0,0,0,0,
		0,1,0,1,0,1,
		0,0,1,1,1,0,
		0,1,1,0,1,1,
		0,0,1,1,1,0,
		0,1,0,1,0,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 16 */
		0,0,1,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,1,0,
		0,0,1,1,1,1,
		0,0,1,1,1,0,
		0,0,1,1,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 17 */
		0,0,0,0,1,0,
		0,0,0,1,1,0,
		0,0,1,1,1,0,
		0,1,1,1,1,0,
		0,0,1,1,1,0,
		0,0,0,1,1,0,
		0,0,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 18 */
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 19 */
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 20 */
		0,0,1,1,1,1,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,0,1,1,0,1,
		0,0,0,1,0,1,
		0,0,0,1,0,1,
		0,0,0,1,0,1,
		0,0,0,0,0,0,
		/* num: 21 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,0,1,1,0,0,
		0,0,1,0,1,0,
		0,0,0,1,1,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 22 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 23 */
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		/* num: 24 */
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 25 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 26 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,1,1,1,1,1,
		0,0,0,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 27 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,0,0,
		0,1,1,1,1,1,
		0,0,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 28 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 29 */
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,1,1,1,1,1,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 30 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 31 */
		0,1,1,1,1,1,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 32 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 33 */
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 34 */
		0,1,1,0,1,1,
		0,1,1,0,1,1,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 35 */
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,1,1,1,1,1,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,1,1,1,1,1,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 36 */
		0,0,1,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,0,0,
		0,0,0,0,1,0,
		0,1,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 37 */
		0,1,1,0,0,1,
		0,1,1,0,0,1,
		0,0,0,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,1,0,0,1,1,
		0,1,0,0,1,1,
		0,0,0,0,0,0,
		/* num: 38 */
		0,0,1,0,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,0,1,0,0,0,
		0,1,0,1,0,1,
		0,1,0,0,1,0,
		0,0,1,1,0,1,
		0,0,0,0,0,0,
		/* num: 39 */
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 40 */
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 41 */
		0,0,1,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 42 */
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,0,1,1,1,0,
		0,1,1,1,1,1,
		0,0,1,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 43 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 44 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,1,0,0,0,
		/* num: 45 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 46 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 47 */
		0,0,0,0,0,0,
		0,0,0,0,0,1,
		0,0,0,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,1,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 48 ZERO!!!!*/
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,1,1,
		0,1,0,1,0,1,
		0,1,1,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 49 */
		0,0,0,1,0,0,
		0,0,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 50 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,0,0,0,0,1,
		0,0,0,1,1,0,
		0,0,1,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 51 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,0,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 52 */
		0,0,0,0,1,0,
		0,0,0,1,1,0,
		0,0,1,0,1,0,
		0,1,0,0,1,0,
		0,1,1,1,1,1,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 53 */
		0,1,1,1,1,1,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 54 */
		0,0,0,1,1,0,
		0,0,1,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 55 */
		0,1,1,1,1,1,
		0,0,0,0,0,1,
		0,0,0,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 56 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 57 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,1,
		0,0,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 58 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 59 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,1,0,0,0,
		/* num: 60 */
		0,0,0,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,1,0,0,0,0,
		0,0,1,0,0,0,
		0,0,0,1,0,0,
		0,0,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 61 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 62 */
		0,0,1,0,0,0,
		0,0,0,1,0,0,
		0,0,0,0,1,0,
		0,0,0,0,0,1,
		0,0,0,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 63 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,0,0,0,0,1,
		0,0,0,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 64 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,1,1,1,
		0,1,0,1,0,1,
		0,1,0,1,1,1,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 65 Start of Capital Letters*/
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 66 */
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 67 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 68 */
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 69 */
		0,1,1,1,1,1,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 70 */
		0,1,1,1,1,1,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 71 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,0,
		0,1,0,1,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 72 */
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 73 */
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 74 */
		0,0,0,0,0,1,
		0,0,0,0,0,1,
		0,0,0,0,0,1,
		0,0,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 75 */
		0,1,0,0,0,1,
		0,1,0,0,1,0,
		0,1,0,1,0,0,
		0,1,1,0,0,0,
		0,1,0,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 76 */
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 77 */
		0,1,0,0,0,1,
		0,1,1,0,1,1,
		0,1,0,1,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 78 */
		0,1,0,0,0,1,
		0,1,1,0,0,1,
		0,1,0,1,0,1,
		0,1,0,0,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 79 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 80 */
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 81 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,1,0,1,
		0,1,0,0,1,0,
		0,0,1,1,0,1,
		0,0,0,0,0,0,
		/* num: 82 */
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 83 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 84 */
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 85 */
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 86 */
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 87 */
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 88 */
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 89 */
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 90 */
		0,1,1,1,1,0,
		0,0,0,0,1,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 91 */
		0,0,1,1,1,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 92 */
		0,0,0,0,0,0,
		0,1,0,0,0,0,
		0,0,1,0,0,0,
		0,0,0,1,0,0,
		0,0,0,0,1,0,
		0,0,0,0,0,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 93 */
		0,0,1,1,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 94 */
		0,0,0,1,0,0,
		0,0,1,0,1,0,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 95 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		/* num: 96 */
		0,0,1,1,0,0,
		0,0,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 97 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 98 */
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 99 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 100 */
		0,0,0,0,0,1,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 101 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 102 */
		0,0,0,1,1,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,1,1,1,1,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 103 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,1,
		0,0,1,1,1,0,
		/* num: 104 */
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 105 */
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 106 */
		0,0,0,0,1,0,
		0,0,0,0,0,0,
		0,0,0,1,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		/* num: 107 */
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,1,0,0,
		0,1,1,0,0,0,
		0,1,0,1,0,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 108 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 109 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,0,1,0,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 110 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 111 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 112 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		/* num: 113 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,1,
		/* num: 114 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,1,1,0,
		0,0,1,0,0,1,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,1,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 115 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 116 */
		0,0,0,0,0,0,
		0,0,1,0,0,0,
		0,1,1,1,1,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 117 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 118 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 119 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,1,0,1,
		0,1,1,1,1,1,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 120 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 121 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,1,1,0,0,0,
		/* num: 122 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,1,0,
		0,0,1,1,0,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 123 */
		0,0,0,1,1,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,1,1,0,0,0,
		0,0,1,0,0,0,
		0,0,1,0,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 124 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 125 */
		0,0,1,1,0,0,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,0,0,1,1,
		0,0,0,0,1,0,
		0,0,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 126 */
		0,0,1,0,1,0,
		0,1,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 127 */
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,1,0,1,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 128 */
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,1,1,0,0,
		/* num: 129 */
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 130 */
		0,0,0,0,1,1,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 131 */
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 132 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 133 */
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 134 */
		0,0,1,1,1,0,
		0,0,1,0,1,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 135 */
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,1,1,0,0,
		/* num: 136 */
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 137 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 138 */
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 139 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 140 */
		0,0,0,1,0,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 141 */
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 142 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,0,1,0,
		0,1,0,0,0,1,
		0,1,1,1,1,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 143 */
		0,0,1,1,1,0,
		0,0,1,0,1,0,
		0,0,1,1,1,0,
		0,1,1,0,1,1,
		0,1,0,0,0,1,
		0,1,1,1,1,1,
		0,1,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 144 */
		0,0,0,0,1,1,
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 145 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,1,0,1,
		0,1,1,1,1,1,
		0,1,0,1,0,0,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 146 */
		0,0,1,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,1,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,1,1,
		0,0,0,0,0,0,
		/* num: 147 */
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 148 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 149 */
		0,1,1,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 150 */
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 151 */
		0,1,1,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 152 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,1,1,0,0,0,
		/* num: 153 */
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 154 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 155 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 156 */
		0,0,0,1,1,0,
		0,0,1,0,0,1,
		0,0,1,0,0,0,
		0,1,1,1,1,0,
		0,0,1,0,0,0,
		0,0,1,0,0,1,
		0,1,0,1,1,1,
		0,0,0,0,0,0,
		/* num: 157 */
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 158 */
		0,1,1,0,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,1,0,1,0,
		0,1,0,1,1,1,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 159 */
		0,0,0,0,1,0,
		0,0,0,1,0,1,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,1,0,1,0,0,
		0,0,1,0,0,0,
		/* num: 160 */
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 161 */
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		/* num: 162 */
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 163 */
		0,0,0,1,1,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 164 */
		0,0,1,0,1,0,
		0,1,0,1,0,0,
		0,0,0,0,0,0,
		0,1,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 165 */
		0,0,1,0,1,0,
		0,1,0,1,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,1,0,1,0,
		0,1,0,1,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		/* num: 166 */
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 167 */
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 168 */
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 169 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 170 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,1,
		0,0,0,0,0,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 171 */
		0,1,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,1,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,0,0,0,1,0,
		0,0,0,1,1,1,
		0,0,0,0,0,0,
		/* num: 172 */
		0,1,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,1,0,0,
		0,0,1,0,1,1,
		0,1,0,1,0,1,
		0,0,0,1,1,1,
		0,0,0,0,0,1,
		0,0,0,0,0,0,
		/* num: 173 */
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 174 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,0,0,1,
		0,1,0,0,1,0,
		0,0,1,0,0,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 175 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,0,1,0,0,1,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 176 */
		0,1,0,1,0,1,
		0,0,0,0,0,0,
		1,0,1,0,1,0,
		0,0,0,0,0,0,
		0,1,0,1,0,1,
		0,0,0,0,0,0,
		1,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 177 */
		0,1,0,1,0,1,
		1,0,1,0,1,0,
		0,1,0,1,0,1,
		1,0,1,0,1,0,
		0,1,0,1,0,1,
		1,0,1,0,1,0,
		0,1,0,1,0,1,
		1,0,1,0,1,0,
		/* num: 178 */
		1,0,1,0,1,0,
		1,1,1,1,1,1,
		0,1,0,1,0,1,
		1,1,1,1,1,1,
		1,0,1,0,1,0,
		1,1,1,1,1,1,
		0,1,0,1,0,1,
		1,1,1,1,1,1,
		/* num: 179 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 180 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		1,1,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 181 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,1,1,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		/* num: 182 */
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		1,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 183 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 184 */
		0,0,0,0,0,0,
		1,1,1,1,0,0,
		0,0,0,1,0,0,
		1,1,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 185 */
		0,1,0,1,0,0,
		1,1,0,1,0,0,
		0,0,0,1,0,0,
		1,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 186 */
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 187 */
		0,0,0,0,0,0,
		1,1,1,1,0,0,
		0,0,0,1,0,0,
		1,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 188 */
		0,1,0,1,0,0,
		1,1,0,1,0,0,
		0,0,0,1,0,0,
		1,1,1,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 189 */
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		1,1,1,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 190 */
		0,0,0,1,0,0,
		1,1,1,1,0,0,
		0,0,0,1,0,0,
		1,1,1,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 191 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 192 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 193 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 194 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 195 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 196 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 197 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		1,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 198 */
		0,0,0,1,0,0,
		0,0,0,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 199 */
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 200 */
		0,1,0,1,0,0,
		0,1,0,1,1,1,
		0,1,0,0,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 201 */
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,1,0,0,0,0,
		0,1,0,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 202 */
		0,1,0,1,0,0,
		1,1,0,1,1,1,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 203 */
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		1,1,0,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 204 */
		0,1,0,1,0,0,
		0,1,0,1,1,1,
		0,1,0,0,0,0,
		0,1,0,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 205 */
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 206 */
		0,1,0,1,0,0,
		1,1,0,1,1,1,
		0,0,0,0,0,0,
		1,1,0,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 207 */
		0,0,0,1,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 208 */
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 209 */
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		/* num: 210 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		/* num: 211 */
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,0,1,0,0,
		0,1,1,1,1,1,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 212 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		/* num: 213 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 214 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 215 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 216 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 217 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 218 */
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 219 */
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		1,1,1,1,1,1,
		/* num: 220 */
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		/* num: 221 */
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		/* num: 222 */
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		/* num: 223 */
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		/* num: 224 */
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		/* num: 225 */
		0,0,0,0,0,0,
		0,1,1,1,0,0,
		0,1,0,0,1,0,
		0,1,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,1,1,0,0,
		0,1,0,0,0,0,
		/* num: 226 */
		0,1,1,1,1,0,
		0,1,0,0,1,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 227 */
		0,0,0,0,0,0,
		0,1,1,1,1,1,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 228 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,1,
		0,0,1,1,1,1,
		0,1,0,0,0,1,
		0,0,1,1,1,1,
		0,0,0,0,0,0,
		/* num: 229 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,1,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 230 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,1,1,0,0,
		0,1,0,0,0,0,
		0,1,0,0,0,0,
		/* num: 231 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,1,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 232 */
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 233 */
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,1,1,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 234 */
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,0,1,0,
		0,0,1,0,1,0,
		0,1,1,0,1,1,
		0,0,0,0,0,0,
		/* num: 235 */
		0,0,1,1,0,0,
		0,1,0,0,0,0,
		0,0,1,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,0,0,1,0,
		0,0,1,1,0,0,
		0,0,0,0,0,0,
		/* num: 236 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,1,0,1,0,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 237 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,1,0,1,0,1,
		0,1,0,1,0,1,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		/* num: 238 */
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,0,
		0,1,1,1,1,0,
		0,1,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 239 */
		0,0,0,0,0,0,
		0,0,1,1,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 240 */
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 241 */
		0,0,0,0,0,0,
		0,0,0,1,0,0,
		0,0,1,1,1,0,
		0,0,0,1,0,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 242 */
		0,1,0,0,0,0,
		0,0,1,1,0,0,
		0,0,0,0,1,0,
		0,0,1,1,0,0,
		0,1,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 243 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		1,1,1,0,0,0,
		1,0,0,1,1,0,
		1,0,0,0,0,1,
		1,0,0,0,0,0,
		1,1,1,1,1,1,
		/* num: 244 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		1,1,1,1,1,1,
		0,0,0,1,1,1,
		0,1,1,0,0,1,
		1,0,0,0,0,1,
		0,0,0,0,0,1,
		1,1,1,1,1,1,
		/* num: 245 */
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,0,0,1,0,0,
		0,1,0,1,0,0,
		0,0,1,0,0,0,
		0,0,0,0,0,0,
		/* num: 246 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,0,1,1,1,0,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,1,0,0,0,1,
		0,0,1,1,1,0,
		0,0,0,0,0,0,
		/* num: 247 */
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		1,1,1,1,1,0,
		/* num: 248 */
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		1,1,1,1,0,0,
		/* num: 249 */
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		1,1,1,0,0,0,
		/* num: 250 */
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		1,1,0,0,0,0,
		/* num: 251 */
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		1,0,0,0,0,0,
		/* num: 252 */
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		0,1,0,1,1,0,
		0,0,1,0,1,0,
		0,0,0,0,0,0,
		/* num: 253 */
		0,1,1,0,0,0,
		0,0,0,1,0,0,
		0,0,1,0,0,0,
		0,1,1,1,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		/* num: 254 */
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0,
		0,1,1,1,1,0,
		1,1,0,0,1,0,
		1,1,0,0,1,1,
		1,1,1,1,1,0,
		0,0,1,1,1,1,
		/* num: 255 */
		0,1,0,0,1,0,
		1,1,1,1,1,1,
		0,1,0,0,1,0,
		0,1,0,0,1,0,
		1,1,1,1,1,1,
		0,1,0,0,1,0,
		0,0,0,0,0,0,
		0,0,0,0,0,0
		];