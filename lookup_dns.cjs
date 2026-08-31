const dns = require('dns');

dns.resolve4('vxxgvdlqvvchtlmqnrqf.supabase.co', (err, addresses) => {
  if (err) {
    console.error("DNS Resolve failed:", err);
    return;
  }
  console.log("IPv4 Addresses:", addresses);
  
  // Reverse lookup to find hostname
  if (addresses.length > 0) {
    dns.reverse(addresses[0], (err, hostnames) => {
      if (err) {
        console.error("Reverse DNS lookup failed:", err);
        return;
      }
      console.log("Hostnames for IP:", hostnames);
    });
  }
});
