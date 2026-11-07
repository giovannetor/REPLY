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
  graphics.fillStyle(0x07111f, 1);
  graphics.fillRect(0, 0, 32, 32);
  graphics.fillStyle(0x22d3ee, 1);
  graphics.fillRect(2, 2, 28, 28);
  graphics.fillStyle(0x0e7490, 1);
  graphics.fillRect(2, 22, 28, 8);
  graphics.fillStyle(0x07111f, 1);
  graphics.fillRect(6, 8, 20, 9);
  graphics.fillStyle(0xe0faff, 1);
  graphics.fillRect(9, 10, 4, 4);
  graphics.fillRect(19, 10, 4, 4);
  graphics.fillStyle(0x67e8f9, 1);
  graphics.fillRect(12, 24, 8, 3);
  graphics.generateTexture(PLAYER_TEXTURE, 32, 32);
  graphics.destroy();
}
