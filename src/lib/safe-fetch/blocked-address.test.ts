import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "./blocked-address";

describe("isBlockedAddress", () => {
  it.each([
    ["0.0.0.0"],
    ["10.0.0.1"],
    ["100.64.0.1"],
    ["127.0.0.1"],
    ["169.254.169.254"],
    ["172.16.0.0"],
    ["172.31.255.255"],
    ["192.0.0.1"],
    ["192.0.2.1"],
    ["192.88.99.1"],
    ["192.168.1.1"],
    ["198.18.0.1"],
    ["198.51.100.1"],
    ["203.0.113.1"],
    ["224.0.0.1"],
    ["240.0.0.1"],
    ["255.255.255.255"],
  ])("should block %s when it is a non-public IPv4 address", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    ["::"],
    ["::1"],
    ["fc00::1"],
    ["fd12:3456::1"],
    ["fe80::1"],
    ["fe80::1%en0"],
    ["2606:4700::1%en0"],
    ["::ffff:8.8.8.8%en0"],
    ["fec0::1"],
    ["ff02::1"],
    ["64:ff9b::7f00:1"],
    ["100::1"],
    ["2001::1"],
    ["2001:10::1"],
    ["3fff::1"],
    ["2001:db8::1"],
    ["2002:7f00:1::"],
  ])("should block %s when it is a non-public IPv6 address", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([["::ffff:127.0.0.1"], ["::ffff:7f00:1"], ["::ffff:a9fe:a9fe"]])(
    "should block %s when it maps to an internal IPv4 address",
    (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    },
  );

  it.each([["not-an-ip"], [""], ["example.com"]])(
    "should block %j when it is not an IP address",
    (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    },
  );

  it.each([
    ["8.8.8.8"],
    ["1.1.1.1"],
    ["9.255.255.255"],
    ["11.0.0.0"],
    ["172.15.255.255"],
    ["172.32.0.0"],
    ["192.167.255.255"],
    ["223.255.255.255"],
    ["2606:4700:4700::1111"],
    ["2a00:1450:4001::1"],
    ["::ffff:8.8.8.8"],
  ])("should allow %s when it is a public address", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});
