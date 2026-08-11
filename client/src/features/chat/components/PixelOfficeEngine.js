/**
 * PixelOfficeEngine.js
 * A high-fidelity retro 2D pixel-art office render engine powered by HTML5 Canvas.
 * Implements procedural retro styling, walking sprites, and grid-based A* pathfinding.
 */

// Grid settings
export const TILE_SIZE = 32;
export const MAP_COLS = 20;
export const MAP_ROWS = 15;

// Tile types
export const TILE_TYPES = {
  FLOOR: 0,
  WALL: 1,
  DESK: 2,
  CHAIR: 3,
  TABLE: 4,
  SERVER: 5,
  PRINTER: 6,
  COFFEE: 7,
  PLANT: 8,
};

// Define office grid layout (20x15 matrix)
// 0 = Empty floor, 1 = Wall, 2 = Desk, 5 = Server, 6 = Printer, 7 = Coffee cabinet, 8 = Plant
export const OFFICE_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 1],
  [1, 0, 5, 5, 5, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 7, 7, 0, 0, 1],
  [1, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// Target coordinates of key locations
export const LOCATIONS = {
  // Desks for up to 6 developers / agents
  DESKS: [
    { x: 7, y: 2 },
    { x: 12, y: 2 },
    { x: 2, y: 6 },
    { x: 17, y: 6 },
    { x: 2, y: 9 },
    { x: 17, y: 9 },
  ],
  // Central conference table seats (around table at center)
  MEETING: [
    { x: 8, y: 7 },
    { x: 9, y: 7 },
    { x: 10, y: 7 },
    { x: 8, y: 8 },
    { x: 9, y: 8 },
    { x: 10, y: 8 },
  ],
  // Coffee break water cooler corner
  COFFEE: { x: 15, y: 3 },
  // Server room printer corner
  PRINTER: { x: 4, y: 5 },
};

/**
 * A* Pathfinding Node definition
 */
class AStarNode {
  constructor(x, y, parent = null) {
    this.x = x;
    this.y = y;
    this.g = 0; // Cost from start
    this.h = 0; // Heuristic cost to end
    this.f = 0; // Total cost
    this.parent = parent;
  }
}

/**
 * Checks if a grid coordinate is walkable (no collision with walls, tables or desks)
 */
export function isWalkable(x, y) {
  if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) return false;
  
  // Outer walls boundary check
  const cellType = OFFICE_MAP[y][x];
  if (cellType === TILE_TYPES.WALL || cellType === TILE_TYPES.SERVER || cellType === TILE_TYPES.DESK) {
    return false;
  }

  // Central conference table collision boundaries (cols 8 to 11, rows 7 to 8)
  if (x >= 8 && x <= 11 && y >= 7 && y <= 8) {
    return false;
  }

  return true;
}

/**
 * Classical A* Pathfinding implementation
 */
export function findPath(startX, startY, endX, endY) {
  // Clamp target positions if off-grid
  startX = Math.max(0, Math.min(MAP_COLS - 1, startX));
  startY = Math.max(0, Math.min(MAP_ROWS - 1, startY));
  endX = Math.max(0, Math.min(MAP_COLS - 1, endX));
  endY = Math.max(0, Math.min(MAP_ROWS - 1, endY));

  // If start is same as end, return empty path
  if (startX === endX && startY === endY) return [];

  // Make sure target is walkable, if not, find closest walkable neighbor
  if (!isWalkable(endX, endY)) {
    const neighbors = [
      { x: endX + 1, y: endY },
      { x: endX - 1, y: endY },
      { x: endX, y: endY + 1 },
      { x: endX, y: endY - 1 },
    ];
    let found = false;
    for (const n of neighbors) {
      if (isWalkable(n.x, n.y)) {
        endX = n.x;
        endY = n.y;
        found = true;
        break;
      }
    }
    if (!found) return [];
  }

  const openList = [];
  const closedList = new Set();

  const startNode = new AStarNode(startX, startY);
  const endNode = new AStarNode(endX, endY);
  openList.push(startNode);

  while (openList.length > 0) {
    // Find node with lowest f score
    let currentIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[currentIndex].f) {
        currentIndex = i;
      }
    }

    const currentNode = openList[currentIndex];

    // Check if reached destination
    if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
      const path = [];
      let curr = currentNode;
      while (curr !== null) {
        path.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path.reverse(); // Returns start-to-end path array
    }

    // Move current node from open to closed
    openList.splice(currentIndex, 1);
    closedList.add(`${currentNode.x},${currentNode.y}`);

    // Generate children neighbors
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    for (const dir of directions) {
      const nextX = currentNode.x + dir.dx;
      const nextY = currentNode.y + dir.dy;

      if (!isWalkable(nextX, nextY)) continue;
      if (closedList.has(`${nextX},${nextY}`)) continue;

      const neighbor = new AStarNode(nextX, nextY, currentNode);
      neighbor.g = currentNode.g + 1;
      // Manhattan distance heuristic
      neighbor.h = Math.abs(neighbor.x - endNode.x) + Math.abs(neighbor.y - endNode.y);
      neighbor.f = neighbor.g + neighbor.h;

      // Check if neighbor already in open list with lower g score
      let skip = false;
      for (const openNode of openList) {
        if (openNode.x === neighbor.x && openNode.y === neighbor.y && openNode.g <= neighbor.g) {
          skip = true;
          break;
        }
      }

      if (!skip) {
        openList.push(neighbor);
      }
    }
  }

  return []; // No path found
}

/**
 * Draws a retro styled pixel tilemap on the canvas context
 */
export function drawMap(ctx) {
  // Clear canvas
  ctx.fillStyle = '#1e1e24';
  ctx.fillRect(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

  // 1. Draw floor wood planks (procedural retro tile blocks)
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const cell = OFFICE_MAP[r][c];

      // Base wood floor
      ctx.fillStyle = r % 2 === 0 ? '#3e2723' : '#4e342e'; // Wood browns
      ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      // Wood textures lines
      ctx.strokeStyle = '#271714';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      
      // Fine grain streaks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(c * TILE_SIZE + 4, r * TILE_SIZE + 8, TILE_SIZE - 8, 3);
      ctx.fillRect(c * TILE_SIZE + 12, r * TILE_SIZE + 18, TILE_SIZE - 16, 2);

      // Render static room obstacles
      if (cell === TILE_TYPES.WALL) {
        // Wall tiles
        ctx.fillStyle = '#37474f'; // Dark slate blue
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        ctx.strokeStyle = '#263238';
        ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Brick highlight lines
        ctx.fillStyle = '#455a64';
        ctx.fillRect(c * TILE_SIZE + 1, r * TILE_SIZE + 1, TILE_SIZE - 2, 4);
      } else if (cell === TILE_TYPES.SERVER) {
        // Mainframes / Servers
        ctx.fillStyle = '#212121'; // Deep charcoal
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        ctx.strokeStyle = '#424242';
        ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Glowing server light animations (procedural flicker)
        const flicker = Math.floor(Date.now() / 150) % 3;
        ctx.fillStyle = flicker === 0 ? '#00e676' : flicker === 1 ? '#ff1744' : '#2979ff';
        ctx.fillRect(c * TILE_SIZE + 6, r * TILE_SIZE + 8, 4, 4);
        ctx.fillRect(c * TILE_SIZE + 6, r * TILE_SIZE + 18, 4, 4);
        ctx.fillStyle = flicker === 2 ? '#ffea00' : '#424242';
        ctx.fillRect(c * TILE_SIZE + 16, r * TILE_SIZE + 8, 4, 4);
      } else if (cell === TILE_TYPES.DESK) {
        // Office Computer Desks
        ctx.fillStyle = '#795548'; // Oak Wood color
        ctx.fillRect(c * TILE_SIZE + 2, r * TILE_SIZE + 6, TILE_SIZE - 4, TILE_SIZE - 8);

        // Monitor
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(c * TILE_SIZE + 6, r * TILE_SIZE + 2, TILE_SIZE - 12, 10);
        ctx.fillStyle = '#00c853'; // Neon green coding screen lines
        ctx.fillRect(c * TILE_SIZE + 8, r * TILE_SIZE + 4, TILE_SIZE - 16, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(c * TILE_SIZE + 12, r * TILE_SIZE + 11, 8, 2); // Stand
      } else if (cell === TILE_TYPES.PLANT) {
        // Green potted plant
        ctx.fillStyle = '#a1887f'; // Brown pot
        ctx.fillRect(c * TILE_SIZE + 10, r * TILE_SIZE + 20, 12, 8);
        ctx.fillStyle = '#2e7d32'; // Green leaves
        ctx.beginPath();
        ctx.arc(c * TILE_SIZE + 16, r * TILE_SIZE + 12, 8, 0, Math.PI * 2);
        ctx.arc(c * TILE_SIZE + 12, r * TILE_SIZE + 8, 6, 0, Math.PI * 2);
        ctx.arc(c * TILE_SIZE + 20, r * TILE_SIZE + 8, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === TILE_TYPES.COFFEE) {
        // Yellow espresso machine and shelf
        ctx.fillStyle = '#6d4c41'; // Coffee shelf brown
        ctx.fillRect(c * TILE_SIZE + 2, r * TILE_SIZE + 4, TILE_SIZE - 4, TILE_SIZE - 4);
        
        ctx.fillStyle = '#ffd600'; // Golden coffee maker
        ctx.fillRect(c * TILE_SIZE + 8, r * TILE_SIZE + 8, 16, 12);
        ctx.fillStyle = '#ff1744'; // Red mug
        ctx.fillRect(c * TILE_SIZE + 18, r * TILE_SIZE + 15, 6, 5);
      } else if (cell === TILE_TYPES.PRINTER) {
        // Printer unit
        ctx.fillStyle = '#eceff1'; // Light printer body gray
        ctx.fillRect(c * TILE_SIZE + 4, r * TILE_SIZE + 8, TILE_SIZE - 8, TILE_SIZE - 12);
        ctx.fillStyle = '#b0bec5'; // Darker trays
        ctx.fillRect(c * TILE_SIZE + 8, r * TILE_SIZE + 4, 16, 4);

        // Flashing active blue printing indicator
        const activeFlash = Math.floor(Date.now() / 300) % 2 === 0;
        ctx.fillStyle = activeFlash ? '#00b0ff' : '#546e7a';
        ctx.fillRect(c * TILE_SIZE + 6, r * TILE_SIZE + 10, 3, 3);
      }
    }
  }

  // 2. Draw Central Meeting Table & Chairs (custom mahogany board shape)
  // Conference table covers column indices 8 to 11, row indices 7 to 8
  ctx.fillStyle = '#8d6e63'; // Polished Mahogany table color
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 3;
  
  const tx = 8 * TILE_SIZE;
  const ty = 7 * TILE_SIZE;
  const tw = 4 * TILE_SIZE;
  const th = 2 * TILE_SIZE;
  
  // Table plate
  ctx.fillRect(tx + 6, ty + 6, tw - 12, th - 12);
  ctx.strokeRect(tx + 6, ty + 6, tw - 12, th - 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(tx + 12, ty + 12, tw - 24, th - 24);

  // Around the table chairs (top and bottom rows)
  ctx.fillStyle = '#263238'; // Dark chairs
  for (let c = 8; c <= 11; c++) {
    // Top chairs
    ctx.fillRect(c * TILE_SIZE + 8, 7 * TILE_SIZE - 4, 16, 8);
    ctx.fillStyle = '#37474f';
    ctx.fillRect(c * TILE_SIZE + 10, 7 * TILE_SIZE - 3, 12, 4);
    
    // Bottom chairs
    ctx.fillStyle = '#263238';
    ctx.fillRect(c * TILE_SIZE + 8, 9 * TILE_SIZE - 4, 16, 8);
    ctx.fillStyle = '#37474f';
    ctx.fillRect(c * TILE_SIZE + 10, 9 * TILE_SIZE - 1, 12, 4);
  }
}

// Map role titles to color indicators to styling characters elegantly
const ROLE_COLORS = {
  CEO: { base: '#ffb300', pants: '#b7950b', skin: '#ffe0b2', name: '首席执行官' },      // Gold CEO
  PM: { base: '#2979ff', pants: '#1565c0', skin: '#ffe0b2', name: '项目经理' },      // Blue PM
  Developer: { base: '#00e676', pants: '#003300', skin: '#ffcc80', name: '开发工程师' }, // Green Developer
  Architect: { base: '#d500f9', pants: '#4a148c', skin: '#ffe0b2', name: '系统架构师' }, // Purple Architect
  Tester: { base: '#ff1744', pants: '#880e4f', skin: '#ffd54f', name: '测试分析师' },    // Red Tester
  General: { base: '#ff9100', pants: '#e65100', skin: '#ffcc80', name: '智能助理' },    // Orange General Helper
};

/**
 * Draws a retro animated walking sprite on the canvas
 */
export function drawCharacter(ctx, agent, frame) {
  const { x, y, name, role = 'General', state, path } = agent;
  
  // Real screen coordinates (smoothly interpolated)
  const screenX = x * TILE_SIZE;
  const screenY = y * TILE_SIZE;

  const style = ROLE_COLORS[role] || ROLE_COLORS.General;

  // Stepping bobbing offset
  const isMoving = path && path.length > 0;
  const bobbing = isMoving ? Math.abs(Math.sin(frame * 0.4)) * 3 : 0;

  // 1. Shadow underneath the character
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(screenX + 16, screenY + 28, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Character body (outfit shirt)
  ctx.fillStyle = style.base;
  ctx.fillRect(screenX + 10, screenY + 16 - bobbing, 12, 10);

  // 3. Pants/Shoes
  ctx.fillStyle = style.pants;
  const stepLeft = isMoving && Math.floor(frame / 2) % 2 === 0;
  ctx.fillRect(screenX + 10, screenY + 25 - bobbing, 5, stepLeft ? 3 : 4);
  ctx.fillRect(screenX + 17, screenY + 25 - bobbing, 5, stepLeft ? 4 : 3);

  // 4. Face/Skin Head
  ctx.fillStyle = style.skin;
  ctx.fillRect(screenX + 11, screenY + 8 - bobbing, 10, 8);

  // Hair & Glasses (Role distinct indicators)
  if (role === 'CEO') {
    // gold crown and hair
    ctx.fillStyle = '#263238'; // neat dark hair
    ctx.fillRect(screenX + 11, screenY + 6 - bobbing, 10, 3);
    ctx.fillStyle = '#ffd700'; // shiny gold crown
    ctx.fillRect(screenX + 12, screenY + 3 - bobbing, 2, 3);
    ctx.fillRect(screenX + 15, screenY + 1 - bobbing, 2, 5);
    ctx.fillRect(screenX + 18, screenY + 3 - bobbing, 2, 3);
  } else if (role === 'PM') {
    ctx.fillStyle = '#3e2723'; // Neat hair
    ctx.fillRect(screenX + 11, screenY + 6 - bobbing, 10, 3);
  } else if (role === 'Developer') {
    ctx.fillStyle = '#0a0a0a'; // Programmer glasses
    ctx.fillRect(screenX + 11, screenY + 6 - bobbing, 10, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(screenX + 13, screenY + 10 - bobbing, 2, 2);
    ctx.fillRect(screenX + 17, screenY + 10 - bobbing, 2, 2);
  } else if (role === 'Architect') {
    ctx.fillStyle = '#37474f'; // Grey/silver hair
    ctx.fillRect(screenX + 11, screenY + 6 - bobbing, 10, 3);
    ctx.fillRect(screenX + 10, screenY + 8 - bobbing, 2, 4); // Long sideburns
    ctx.fillRect(screenX + 20, screenY + 8 - bobbing, 2, 4);
  } else if (role === 'Tester') {
    ctx.fillStyle = '#f57c00'; // Orange ponytail
    ctx.fillRect(screenX + 11, screenY + 6 - bobbing, 10, 3);
    ctx.fillStyle = '#ef6c00';
    ctx.fillRect(screenX + 8, screenY + 9 - bobbing, 3, 5); // Hair tie back
  } else {
    ctx.fillStyle = '#424242'; // Dark hair
    ctx.fillRect(screenX + 11, screenY + 6 - bobbing, 10, 3);
  }

  // Little eyes
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(screenX + 13, screenY + 11 - bobbing, 2, 2);
  ctx.fillRect(screenX + 17, screenY + 11 - bobbing, 2, 2);

  // 5. Active speech bubble text or state tags overlay
  if (state && !agent.speechText) {
    ctx.font = 'bold 8px Outfit, Inter, sans-serif';
    
    // Select state labels
    let label = 'Working';
    let color = '#ffd600'; // Yellow
    if (state === 'DEBATING') { label = 'Speech 🗣️'; color = '#d500f9'; }
    else if (state === 'SLACKING') { label = 'Slack ☕'; color = '#ffd600'; }
    else if (state === 'WORKING') { label = 'Coding 💻'; color = '#00e676'; }
    else if (state === 'OUTPUTTING') { label = 'Print 📠'; color = '#00b0ff'; }

    // Renders miniature text tag
    const width = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(screenX + 16 - (width / 2) - 4, screenY - 14 - bobbing, width + 8, 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 16 - (width / 2) - 4, screenY - 14 - bobbing, width + 8, 12);

    ctx.fillStyle = '#fff';
    ctx.fillText(label, screenX + 16 - (width / 2), screenY - 5 - bobbing);
  }

  // 6. Draw active chat dialog speech bubble directly on the canvas!
  if (agent.speechText) {
    drawSpeechBubble(ctx, agent.speechText, screenX + 16, screenY - bobbing);
  }

  // 7. Renders the agent's name badge underneath the character
  ctx.font = '8px Outfit, Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const nameWidth = ctx.measureText(name).width;
  ctx.fillRect(screenX + 16 - (nameWidth / 2) - 3, screenY + 33, nameWidth + 6, 11);
  ctx.fillStyle = '#263238';
  ctx.fillText(name, screenX + 16 - (nameWidth / 2), screenY + 41);
}

/**
 * Draws a retro speech balloon directly on the canvas
 */
function drawSpeechBubble(ctx, text, anchorX, anchorY) {
  // Simple word wrapping for maximum length of 24 chars
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (let n = 0; n < words.length; n++) {
    const testLine = currentLine + words[n] + ' ';
    ctx.font = 'bold 9px monospace, sans-serif';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > 120 && n > 0) {
      lines.push(currentLine.trim());
      currentLine = words[n] + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  // Bubble dimensions
  const lineHeight = 12;
  const bubbleHeight = lines.length * lineHeight + 12;
  let bubbleWidth = 40;
  for (const line of lines) {
    const lineMetrics = ctx.measureText(line);
    if (lineMetrics.width > bubbleWidth) {
      bubbleWidth = lineMetrics.width;
    }
  }
  bubbleWidth += 16; // Add margin

  // Position bubble above the character's head
  const bx = anchorX - bubbleWidth / 2;
  const by = anchorY - bubbleHeight - 16;

  // 1. Draw bubble container
  ctx.fillStyle = '#ffffff'; // Retro white box
  ctx.strokeStyle = '#000000'; // Crisp black boarder
  ctx.lineWidth = 2;
  ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);
  ctx.strokeRect(bx, by, bubbleWidth, bubbleHeight);

  // 2. Draw Speech balloon downward indicator triangle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(anchorX - 6, by + bubbleHeight);
  ctx.lineTo(anchorX + 6, by + bubbleHeight);
  ctx.lineTo(anchorX, by + bubbleHeight + 8);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(anchorX - 6, by + bubbleHeight);
  ctx.lineTo(anchorX, by + bubbleHeight + 8);
  ctx.lineTo(anchorX + 6, by + bubbleHeight);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Write text lines
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 9px monospace, sans-serif';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + 8, by + 14 + i * lineHeight);
  }
}
