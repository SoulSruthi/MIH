import { describe, it, expect } from 'vitest';
import { isPrivateIp, SsrfError, guardCrmUrl } from '../../src/modules/crm-handoff/dns-guard';

describe('isPrivateIp', () => {
  it('detects 10.x.x.x', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
  });

  it('detects 172.16-31.x.x', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('172.15.0.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('detects 192.168.x.x', () => {
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('192.169.0.1')).toBe(false);
  });

  it('detects 127.x', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);
  });

  it('allows public IPs', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('52.84.1.1')).toBe(false);
  });
});

describe('guardCrmUrl', () => {
  it('throws SsrfError for private IP in URL', async () => {
    await expect(guardCrmUrl('https://192.168.1.100/api')).rejects.toThrow(SsrfError);
    await expect(guardCrmUrl('https://10.0.0.1/api')).rejects.toThrow(SsrfError);
    await expect(guardCrmUrl('https://127.0.0.1/api')).rejects.toThrow(SsrfError);
  });

  it('throws SsrfError for invalid URL', async () => {
    await expect(guardCrmUrl('not-a-url')).rejects.toThrow(SsrfError);
  });

  it('throws SsrfError for non-http protocol', async () => {
    await expect(guardCrmUrl('file:///etc/passwd')).rejects.toThrow(SsrfError);
    await expect(guardCrmUrl('ftp://example.com')).rejects.toThrow(SsrfError);
  });
});
