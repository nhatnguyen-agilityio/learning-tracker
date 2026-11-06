import { BlockList, isIP } from "node:net";

function subnets(family: "ipv4" | "ipv6", ranges: [string, number][]) {
  const list = new BlockList();
  for (const [network, prefix] of ranges) {
    list.addSubnet(network, prefix, family);
  }
  return list;
}

const blockedIpv4 = subnets("ipv4", [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]);

const ipv4Mapped = subnets("ipv6", [["::ffff:0:0", 96]]);
const globalUnicast = subnets("ipv6", [["2000::", 3]]);

// IETF-reserved, documentation and 6to4 ranges sit inside 2000::/3 but are not
// public destinations; Teredo (2001::/32) and 6to4 can also embed any IPv4.
const blockedGlobalUnicast = subnets("ipv6", [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
]);

/** An address that isn't certainly a public IP is blocked. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedIpv4.check(address, "ipv4");
  // An address with a zone (fe80::1%en0) is only used on a local network.
  if (family !== 6 || address.includes("%")) return true;
  if (ipv4Mapped.check(address, "ipv6")) {
    return blockedIpv4.check(address, "ipv6");
  }
  return (
    !globalUnicast.check(address, "ipv6") ||
    blockedGlobalUnicast.check(address, "ipv6")
  );
}
