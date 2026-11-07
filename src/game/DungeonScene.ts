import Phaser from 'phaser';
import { DOORS, DOOR_BY_ID } from '../content/course';
import { DOOR_IDS, type DoorId } from '../domain/challenge';
import { gameEvents } from './events';
import { ensurePlaceholderTextures, PLAYER_TEXTURE } from './textures';

const WIDTH = 960;
const HEIGHT = 600;

const DOOR_POSITIONS: Record<DoorId, { x: number; y: number }> = {
  logic: { x: 200, y: 66 },
  order: { x: 480, y: 66 },
  truth: { x: 760, y: 66 },
};

const GATE_POSITION = { x: 480, y: 566 };

interface DoorVisual {
  base: Phaser.GameObjects.Rectangle;
  inner: Phaser.GameObjects.Rectangle;
  rune: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
}

type Interaction = { kind: 'door'; doorId: DoorId } | { kind: 'gate' };

export class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private playerLabel!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private prompt!: Phaser.GameObjects.Text;
  private readonly doorVisuals = new Map<DoorId, DoorVisual>();
  private gateVisual!: {
    base: Phaser.GameObjects.Rectangle;
    inner: Phaser.GameObjects.Rectangle;
    rune: Phaser.GameObjects.Text;
    label: Phaser.GameObjects.Text;
  };
  private readonly solved = new Set<DoorId>();
  private pausedForUi = false;
  private gateOpened = false;
  private enteringBoss = false;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super('DungeonScene');
  }

  create(): void {
    ensurePlaceholderTextures(this);
    this.cameras.main.setBackgroundColor('#05070f');
    this.drawFloor();
    this.walls = this.physics.add.staticGroup();
    this.createWalls();
    this.createDoors();
    this.createGate();
    this.createPlayer();
    this.createPrompt();
    this.setupInput();
    this.bindEvents();
    this.physics.world.setBounds(48, 48, WIDTH - 96, HEIGHT - 96);
  }

  update(): void {
    if (!this.player || this.pausedForUi) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;

    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    let vy = (down ? 1 : 0) - (up ? 1 : 0);
    if (vx !== 0 || vy !== 0) {
      const length = Math.hypot(vx, vy);
      vx = (vx / length) * 225;
      vy = (vy / length) * 225;
      body.setVelocity(vx, vy);
    } else {
      body.setVelocity(0, 0);
    }

    this.shadow.setPosition(this.player.x, this.player.y + 14);
    this.playerLabel.setPosition(this.player.x, this.player.y - 26);

    const interaction = this.findInteraction();
    this.updatePrompt(interaction);

    if (interaction && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.interact(interaction);
    }
  }

  private drawFloor(): void {
    const floor = this.add.graphics();
    floor.fillStyle(0x080e1c, 1);
    floor.fillRect(0, 0, WIDTH, HEIGHT);

    floor.lineStyle(1, 0x162238, 0.72);
    for (let x = 48; x < WIDTH; x += 48) {
      floor.lineBetween(x, 48, x, HEIGHT - 48);
    }
    for (let y = 48; y < HEIGHT; y += 48) {
      floor.lineBetween(48, y, WIDTH - 48, y);
    }

    floor.lineStyle(2, 0x1e2d4a, 0.55);
    floor.strokeCircle(480, 300, 154);
    floor.lineStyle(1, 0x24334f, 0.5);
    floor.strokeCircle(480, 300, 104);
    floor.strokeRect(76, 76, WIDTH - 152, HEIGHT - 152);

    floor.fillStyle(0x38bdf8, 0.06);
    floor.fillCircle(480, 300, 60);
    floor.fillStyle(0xf472b6, 0.04);
    floor.fillCircle(200, 300, 40);
    floor.fillStyle(0xfbbf24, 0.04);
    floor.fillCircle(760, 300, 40);

    const torchPositions = [
      { x: 96, y: 190 },
      { x: 864, y: 190 },
      { x: 96, y: 410 },
      { x: 864, y: 410 },
    ];
    torchPositions.forEach((position, index) => {
      const glow = this.add.circle(position.x, position.y, 26, 0xfbbf24, 0.08);
      const flame = this.add.circle(position.x, position.y, 5, 0xfbbf24, 0.9);
      this.tweens.add({
        targets: [glow, flame],
        alpha: { from: 0.55, to: 1 },
        scale: { from: 0.9, to: 1.12 },
        duration: 780 + index * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private createWalls(): void {
    const addWall = (x: number, y: number, width: number, height: number): void => {
      const wall = this.add
        .rectangle(x, y, width, height, 0x121c30)
        .setStrokeStyle(1, 0x2b3b5a, 0.9)
        .setDepth(4);
      this.physics.add.existing(wall, true);
      this.walls.add(wall);
    };

    addWall(480, 24, WIDTH, 48);
    addWall(480, 576, WIDTH, 48);
    addWall(24, 300, 48, HEIGHT);
    addWall(936, 300, 48, HEIGHT);

    addWall(320, 250, 64, 64);
    addWall(640, 250, 64, 64);
    addWall(320, 420, 64, 64);
    addWall(640, 420, 64, 64);
  }

  private createDoors(): void {
    for (const door of DOORS) {
      const position = DOOR_POSITIONS[door.id];
      const base = this.add
        .rectangle(position.x, position.y, 92, 74, 0x0b1324)
        .setStrokeStyle(2, door.color, 0.5)
        .setDepth(6);
      const inner = this.add
        .rectangle(position.x, position.y + 2, 68, 46, door.color, 0.1)
        .setDepth(7);
      const rune = this.add
        .text(position.x, position.y - 8, '◆', {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: door.accent,
        })
        .setOrigin(0.5)
        .setDepth(8);
      const status = this.add
        .text(position.x, position.y + 20, 'LOCKED', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#9fb0c7',
        })
        .setOrigin(0.5)
        .setDepth(8);
      const label = this.add
        .text(position.x, position.y + 53, door.shortLabel.toUpperCase(), {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#6f809a',
        })
        .setOrigin(0.5)
        .setDepth(8);

      this.doorVisuals.set(door.id, { base, inner, rune, status, label });
    }
  }

  private createGate(): void {
    const base = this.add
      .rectangle(GATE_POSITION.x, GATE_POSITION.y, 204, 58, 0x0b1324)
      .setStrokeStyle(2, 0x475569, 0.8)
      .setDepth(6);
    const inner = this.add
      .rectangle(GATE_POSITION.x, GATE_POSITION.y, 160, 38, 0x1e293b, 0.45)
      .setDepth(7);
    const rune = this.add
      .text(GATE_POSITION.x, GATE_POSITION.y - 28, '▣', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setDepth(8);
    const label = this.add
      .text(GATE_POSITION.x, GATE_POSITION.y, 'SEALED', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.gateVisual = { base, inner, rune, label };
  }

  private createPlayer(): void {
    this.shadow = this.add.ellipse(480, 344, 32, 11, 0x000000, 0.4).setDepth(9);
    this.player = this.physics.add.sprite(480, 330, PLAYER_TEXTURE).setDepth(10);
    this.player.setCollideWorldBounds(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 24);
    body.setOffset(4, 4);
    this.physics.add.collider(this.player, this.walls);

    this.playerLabel = this.add
      .text(480, 304, 'YOU', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#67e8f9',
      })
      .setOrigin(0.5)
      .setDepth(11);
  }

  private createPrompt(): void {
    this.prompt = this.add
      .text(480, 514, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#dbeafe',
        backgroundColor: 'rgba(5, 10, 22, 0.88)',
        padding: { left: 12, right: 12, top: 8, bottom: 8 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D,E') as Record<
      'W' | 'A' | 'S' | 'D' | 'E',
      Phaser.Input.Keyboard.Key
    >;
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      gameEvents.on('gameplay:pause', ({ paused }) => this.setPaused(paused)),
      gameEvents.on('door:solved', ({ doorId }) => this.markDoorSolved(doorId)),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) {
        unsubscribe();
      }
      this.unsubscribers = [];
    });
  }

  private setPaused(paused: boolean): void {
    this.pausedForUi = paused;
    this.physics.world.isPaused = paused;
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.enabled = !paused;
      if (!paused) {
        keyboard.resetKeys();
      }
    }
    if (paused) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.prompt.setVisible(false);
    }
  }

  private findInteraction(): Interaction | null {
    let result: Interaction | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const door of DOORS) {
      if (this.solved.has(door.id)) {
        continue;
      }
      const position = DOOR_POSITIONS[door.id];
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        position.x,
        position.y + 30,
      );
      if (distance < 108 && distance < bestDistance) {
        result = { kind: 'door', doorId: door.id };
        bestDistance = distance;
      }
    }

    const gateDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      GATE_POSITION.x,
      GATE_POSITION.y - 30,
    );
    if (gateDistance < 125 && gateDistance < bestDistance) {
      result = { kind: 'gate' };
    }

    return result;
  }

  private updatePrompt(interaction: Interaction | null): void {
    if (!interaction) {
      this.prompt.setVisible(false);
      return;
    }

    if (interaction.kind === 'door') {
      const door = DOOR_BY_ID[interaction.doorId];
      this.prompt.setText(`Press E to enter the ${door.label}`).setVisible(true);
      return;
    }

    if (this.allDoorsSolved()) {
      this.prompt.setText('Press E to enter the boss arena').setVisible(true);
      return;
    }

    const remaining = DOOR_IDS.length - this.solved.size;
    this.prompt
      .setText(
        `The gate is sealed. ${remaining} door${remaining === 1 ? '' : 's'} still stand${remaining === 1 ? 's' : ''}.`,
      )
      .setVisible(true);
  }

  private interact(interaction: Interaction): void {
    if (interaction.kind === 'door') {
      gameEvents.emit('door:interact', { doorId: interaction.doorId });
      return;
    }

    if (this.allDoorsSolved() && !this.enteringBoss) {
      this.enteringBoss = true;
      gameEvents.emit('boss:enter', {});
    }
  }

  private allDoorsSolved(): boolean {
    return this.solved.size === DOOR_IDS.length;
  }

  private markDoorSolved(doorId: DoorId): void {
    if (this.solved.has(doorId)) {
      return;
    }
    this.solved.add(doorId);
    const visual = this.doorVisuals.get(doorId);
    if (visual) {
      visual.base.setFillStyle(0x0b211d).setStrokeStyle(3, 0x34d399, 0.9);
      visual.inner.setFillStyle(0x34d399, 0.13);
      visual.rune.setText('✓').setColor('#6ee7b7');
      visual.status.setText('CLEARED').setColor('#6ee7b7');
      visual.label.setColor('#6ee7b7');
      this.tweens.add({
        targets: visual.base,
        alpha: { from: 0.5, to: 1 },
        duration: 240,
        yoyo: true,
        repeat: 2,
      });
    }

    if (this.allDoorsSolved()) {
      this.openGate();
    }
  }

  private openGate(): void {
    if (this.gateOpened) {
      return;
    }
    this.gateOpened = true;
    this.gateVisual.base.setFillStyle(0x2a1c08).setStrokeStyle(3, 0xfbbf24, 1);
    this.gateVisual.inner.setFillStyle(0xfbbf24, 0.13);
    this.gateVisual.rune.setText('◈').setColor('#fbbf24');
    this.gateVisual.label.setText('OPEN').setColor('#fde68a');
    this.tweens.add({
      targets: [this.gateVisual.base, this.gateVisual.inner],
      alpha: { from: 0.65, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
