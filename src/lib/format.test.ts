import { describe, expect, it } from 'vitest';
import { formatBytes, stripExtension } from './format';

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('stripExtension', () => {
  it('drops the last extension', () => {
    expect(stripExtension('logo.png')).toBe('logo');
    expect(stripExtension('a.b.svg')).toBe('a.b');
  });

  it('leaves dotfiles and extensionless names alone', () => {
    expect(stripExtension('.gitignore')).toBe('.gitignore');
    expect(stripExtension('README')).toBe('README');
  });
});
