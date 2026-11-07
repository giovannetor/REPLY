import Phaser from 'phaser';

export const PLAYER_TEXTURE = 'bossfight-player';

/**
 * Tiny generated pixel-art placeholders, so the prototype has no external art
 * dependencies and still reads clearly at a glance.
 */
export function ensurePlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(PLAYER_TEXTURE)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  // Hand-drawn 32px astronaut: helmet, cyan visor, suit and magnetic boots.
  graphics.fillStyle(0x25254d, 1);
  graphics.fillRect(6, 0, 20, 22);
  graphics.fillRect(2, 5, 28, 12);
  graphics.fillStyle(0xdbe7ff, 1);
  graphics.fillRect(8, 2, 16, 18);
  graphics.fillRect(4, 6, 24, 10);
  graphics.fillStyle(0x122243, 1);
  graphics.fillRect(9, 5, 16, 10);
  graphics.fillStyle(0x32def5, 1);
  graphics.fillRect(10, 6, 14, 7);
  graphics.fillStyle(0xc4ffff, 1);
  graphics.fillRect(11, 6, 6, 2);
  graphics.fillStyle(0x9180dc, 1);
  graphics.fillRect(8, 21, 16, 8);
  graphics.fillRect(4, 21, 3, 7);
  graphics.fillRect(25, 21, 3, 7);
  graphics.fillStyle(0xe0edff, 1);
  graphics.fillRect(10, 21, 12, 5);
  graphics.fillRect(8, 29, 6, 3);
  graphics.fillRect(18, 29, 6, 3);
  graphics.fillStyle(0x35e2ef, 1);
  graphics.fillRect(14, 22, 4, 3);
  graphics.generateTexture(PLAYER_TEXTURE, 32, 32);
  graphics.destroy();
}
