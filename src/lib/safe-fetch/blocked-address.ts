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

// Dải dành riêng của IETF, tài liệu và 6to4 nằm trong 2000::/3 nhưng không phải
// đích công khai; Teredo (2001::/32) và 6to4 còn nhúng được IPv4 bất kỳ.
const blockedGlobalUnicast = subnets("ipv6", [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
]);

/** Địa chỉ không chắc chắn là IP công khai thì bị chặn. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedIpv4.check(address, "ipv4");
  // Địa chỉ có zone (fe80::1%en0) chỉ dùng trong mạng cục bộ.
  if (family !== 6 || address.includes("%")) return true;
  if (ipv4Mapped.check(address, "ipv6")) {
    return blockedIpv4.check(address, "ipv6");
  }
  return (
    !globalUnicast.check(address, "ipv6") ||
    blockedGlobalUnicast.check(address, "ipv6")
  );
}
