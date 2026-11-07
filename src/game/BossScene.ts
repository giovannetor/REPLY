import Phaser from 'phaser';
import { BOSS } from '../content/course';
import type { BossState } from '../domain/boss';
import { gameEvents } from './events';
import { ensurePlaceholderTextures, PLAYER_TEXTURE } from './textures';

export class BossScene extends Phaser.Scene {
  private boss!: Phaser.GameObjects.Container;
  private bossCaption!: Phaser.GameObjects.Text;
  private bossSubtitle!: Phaser.GameObjects.Text;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private playerCaption!: Phaser.GameObjects.Text;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super('BossScene');
  }

  create(): void {
    ensurePlaceholderTextures(this);
    this.cameras.main.setBackgroundColor('#080410');
    this.drawArena();
    this.createBoss();
    this.createPlayer();
    this.bindEvents();
    this.cameras.main.fadeIn(450, 0, 0, 0);
    this.time.delayedCall(500, () => gameEvents.emit('boss:ready', {}));
  }

  private drawArena(): void {
    const arena = this.add.graphics();
    arena.fillStyle(0x080410, 1);
    arena.fillRect(0, 0, 960, 600);

    arena.fillStyle(0x1e1035, 0.55);
    arena.fillCircle(480, 280, 290);
    arena.fillStyle(0x2e1065, 0.24);
    arena.fillCircle(480, 280, 205);
    arena.fillStyle(0x160b2b, 1);
    arena.fillEllipse(480, 445, 790, 230);

    arena.lineStyle(2, 0x4c1d95, 0.45);
    arena.strokeEllipse(480, 445, 790, 230);
    arena.lineStyle(1, 0x7c3aed, 0.22);
    arena.strokeEllipse(480, 445, 620, 170);
    arena.strokeCircle(480, 280, 250);

    arena.fillStyle(0x1b1230, 1);
    arena.fillRect(92, 170, 42, 330);
    arena.fillRect(826, 170, 42, 330);
    arena.lineStyle(1, 0x4c1d95, 0.55);
    arena.strokeRect(92, 170, 42, 330);
    arena.strokeRect(826, 170, 42, 330);

    const stars = [
      [156, 96],
      [260, 62],
      [380, 104],
      [612, 72],
      [730, 118],
      [812, 64],
      [214, 250],
      [742, 262],
      [114, 420],
      [846, 402],
    ] as const;
    for (const [x, y] of stars) {
      this.add.circle(x, y, 1.5, 0xc4b5fd, 0.45);
    }

    const leftFlame = this.add.circle(113, 210, 7, 0xa78bfa, 0.9);
    const rightFlame = this.add.circle(847, 210, 7, 0xa78bfa, 0.9);
    this.tweens.add({
      targets: [leftFlame, rightFlame],
      alpha: { from: 0.45, to: 1 },
      scale: { from: 0.8, to: 1.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createBoss(): void {
    const container = this.add.container(480, 230).setDepth(5);

    const aura = this.add.circle(0, 0, 136, 0x7c3aed, 0.08);
    const leftHorn = this.add.triangle(-62, -62, -18, 18, 24, 24, 0, -42, 0x7c3aed, 0.9);
    const rightHorn = this.add.triangle(62, -62, -24, 24, 18, 18, 0, -42, 0x7c3aed, 0.9);
    const body = this.add
      .circle(0, 0, 88, 0x2e1065, 1)
      .setStrokeStyle(3, 0xa78bfa, 0.85);
    const inner = this.add.circle(0, 6, 62, 0x3b0764, 1);
    const leftEye = this.add.triangle(-30, -14, 0, 10, 24, 0, 8, 14, 0xf0abfc);
    const rightEye = this.add.triangle(30, -14, 0, 0, 24, 10, 16, 14, 0xf0abfc);
    const mouth = this.add.rectangle(0, 38, 44, 7, 0x0b0614, 1);

    container.add([aura, leftHorn, rightHorn, body, inner, leftEye, rightEye, mouth]);
    this.boss = container;

    this.bossCaption = this.add
      .text(480, 342, BOSS.name.toUpperCase(), {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#ddd0ff',
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.bossSubtitle = this.add
      .text(480, 364, BOSS.title.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#8b7bb8',
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.tweens.add({
      targets: container,
      y: { from: 230, to: 214 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: aura,
      alpha: { from: 0.05, to: 0.16 },
      scale: { from: 0.92, to: 1.08 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createPlayer(): void {
    this.playerShadow = this.add.ellipse(480, 512, 76, 18, 0x000000, 0.5).setDepth(6);
    this.player = this.add.sprite(480, 486, PLAYER_TEXTURE).setScale(1.65).setDepth(7);
    this.playerCaption = this.add
      .text(480, 544, 'YOU', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#67e8f9',
      })
      .setOrigin(0.5)
      .setDepth(7);

    this.tweens.add({
      targets: this.player,
      y: { from: 486, to: 478 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      gameEvents.on('boss:round-resolved', ({ correct, state }) => {
        this.playRoundResult(correct, state);
      }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) {
        unsubscribe();
      }
      this.unsubscribers = [];
    });
  }

  private playRoundResult(correct: boolean, state: BossState): void {
    if (correct) {
      this.cameras.main.shake(180, 0.006);
      this.tweens.add({
        targets: this.boss,
        x: this.boss.x + 14,
        duration: 55,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
      });
      this.burst(this.boss.x, this.boss.y, 0x67e8f9);
      this.boss.setAlpha(0.55);
      this.time.delayedCall(120, () => this.boss.setAlpha(1));
      if (state.victory) {
        this.defeatBoss();
      }
      return;
    }

    this.cameras.main.shake(320, 0.014);
    this.cameras.main.flash(220, 100, 8, 24);
    this.burst(this.player.x, this.player.y, 0xfb7185);
    this.player.setAlpha(0.4);
    this.time.delayedCall(160, () => this.player.setAlpha(1));
    if (state.playerHp <= 0) {
      this.defeatPlayer();
    }
  }

  private burst(x: number, y: number, color: number): void {
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12 + Math.random() * 0.25;
      const distance = 48 + Math.random() * 62;
      const dot = this.add
        .circle(x, y, 2 + Math.random() * 4, color, 1)
        .setDepth(10);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: 480,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private defeatBoss(): void {
    this.tweens.killTweensOf(this.boss);
    this.cameras.main.flash(300, 120, 80, 220);
    this.tweens.add({
      targets: this.boss,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      angle: 7,
      duration: 900,
      ease: 'Cubic.easeIn',
    });
    this.tweens.add({
      targets: [this.bossCaption, this.bossSubtitle],
      alpha: 0,
      duration: 700,
    });
  }

  private defeatPlayer(): void {
    this.tweens.killTweensOf(this.player);
    this.cameras.main.flash(350, 140, 10, 40);
    this.tweens.add({
      targets: [this.player, this.playerShadow, this.playerCaption],
      alpha: 0.12,
      angle: -7,
      duration: 650,
      ease: 'Cubic.easeIn',
    });
  }
}
