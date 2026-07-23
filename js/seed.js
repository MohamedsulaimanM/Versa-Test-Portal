window.seedReady = (async function () {
  try {
    if (await DB.isSeeded()) return;
    const seedTest = {
      id: 'sse101-seed',
      title: 'SSE-101 Q&A',
      description: 'Versa SSE training assessment covering CASB, SWG, Zero Trust, TLS Decryption, DLP, IPS, SASE Client, and more. 31 questions.',
      timeLimit: 30,
      passingScore: 70,
      published: true,
      createdAt: new Date().toISOString(),
      questions: [
        { type:'multi', text:"What's the difference between CASB and SWG in Versa SSE? (Choose Two)", options:["CASB controls SaaS usage; SWG inspects web traffic","CASB requires a separate license from SWG","CASB is part of the SWG inspection only","CASB is for SaaS Traffic, and SWG is for general internet traffic"], correctIndices:[0,3], points:1 },
        { type:'truefalse', text:"It is recommended to use cloud lookup for URL filtering.", correctBool:true, points:1 },
        { type:'mcq', text:"In the Versa solution, how is Zero Trust access achieved?", options:["Device Posture, Geo-Location, User-Identity","VSPA, Protection Rules and URL Filtering","NGFW, Application Context","All Of Them"], correctIndex:0, points:1 },
        { type:'mcq', text:"What should be done if an app uses certificate pinning and TLS decryption is enabled?", options:["Create Do Not Decrypt TLS rule for the App","No Action required.","\"Bypass Certificate-Pinned Traffic\" Knob should be enabled","App traffic will be decrypted and Security Enforced"], correctIndex:2, points:1 },
        { type:'mcq', text:"A customer wants its mobile users to access only on-prem apps. Which Versa service should they subscribe to?", options:["ZPA","VSPA","VSIA","SASE"], correctIndex:1, points:1 },
        { type:'mcq', text:"Why should TLS decryption be enabled for private apps?", options:["Customer wants visibility of the Traffic.","To apply URL and APP-ID detection","For IPS and Malware Inspection","For DLP Inspection"], correctIndex:2, points:1 },
        { type:'mcq', text:"What type of Authentication is Supported in SASE?", options:["User based","Group Based","Device Based","All of them"], correctIndex:3, points:1 },
        { type:'mcq', text:"In the VSIA use case, when the user is in the office, how do we ensure private traffic is directly accessible?", options:["Trusted Network Detection","Trusted Network Hostname + Excluded Routes","Trusted Network Hostname + Trusted Routes","Trusted Network Hostname"], correctIndex:2, points:1 },
        { type:'mcq', text:"In Versa Analytics, a customer is not able to see SASE Web logs and Firewall logs. What is the problem?", options:["Logging in Secure Access Policies not enabled","Logging in Internet/Private Protection rules are not enabled","At the SSE Tenant level, SASE and Firewall logging is set to mode \"Archive\"","At the SSE Tenant level, SASE and Firewall logging is set to mode \"Analytics\""], correctIndex:3, points:1 },
        { type:'mcq', text:"Customers want the user to be prompted for the Password every 48 hrs.", options:["Configure the Cache timer.","Configure the Cookie timer.","This timer should be set on the customer IDP","Configure the logout interval."], correctIndex:1, points:1 },
        { type:'multi', text:"What type of Integration is supported between Versa SASE GW and customers' on-prem Appliances? (Choose All Applicable)", options:["IPSEC","Versa SD-WAN Overlay","SSL","GRE"], correctIndices:[0,1], points:1 },
        { type:'multi', text:"Which of the following are prerequisites for creating a new SASE Gateway? (Choose Two)", options:["Gateway appliance should be of device type 'Hub Controller'","Gateway appliance should be of device type 'SDWAN'","SASE Director license should be of type 'Cloud Security'","SASE Director license should be of type 'Secure-SDWAN'"], correctIndices:[0,2], points:1 },
        { type:'multi', text:"Which Statement is correct about Fail Close? (Choose Two)", options:["In Fail-Close, users are denied access if the SSE gateway is unreachable","Fail-Close allows temporary access when authentication fails","Fail-Close ensures security is prioritized during service failure","Fail-Close keeps user sessions active even if policy service goes down"], correctIndices:[0,2], points:1 },
        { type:'mcq', text:"What is the function of the DNS Profile in the Versa SASE Client configuration?", options:["To configure DNS Server and Split-Tunnelling on the User Machine.","To point routes and DNS towards S2S tunnel.","To configure DNS Server on SSE Gateways","All of them"], correctIndex:0, points:1 },
        { type:'multi', text:"What is Always-On? (Choose Two)", options:["The user is unable to disconnect the SASE client.","Prevents non-admin users from uninstalling the SSE client.","SASE automatically starts during system boot-up.","The SSE client cannot be uninstalled without a special PIN."], correctIndices:[0,2], points:1 },
        { type:'multi', text:"When both VSPA and VSIA are active, how does the Versa SASE client decide traffic direction? (Choose Two)", options:["All traffic by default will be processed by VSIA","WFH users' traffic is sent to SSE gateway, except for App bypassed locally","Office user public traffic and DNS query will go to SSE gateways.","VSPA and VSIA cannot be active together"], correctIndices:[1,2], points:1 },
        { type:'mcq', text:"Which feature would you use to control granular application activity within SaaS applications?", options:["App-ID Firewall","URL Filtering","CASB","DLP"], correctIndex:2, points:1 },
        { type:'multi', text:"Which file types are supported in Versa DLP fingerprinting? (Choose Two)", options:["JPEG","TEXT","PDF","WORD"], correctIndices:[2,3], points:1 },
        { type:'mcq', text:"In Versa DLP, how can you ensure a rule triggers only if a pattern occurs more than three times?", options:["Configure \"Minimum Occurrence\" threshold as 3","Configure Severity Threshold to Medium","Configure Severity Value to 3","Configure Severity Threshold to Low"], correctIndex:2, points:1 },
        { type:'mcq', text:"Which profile will you configure for assessing the regular device security posture?", options:["EIP Profile","Versa Secure Access Profile","EIP Object","EIP Agent Profile"], correctIndex:3, points:1 },
        { type:'mcq', text:"Which feature restricts users from uninstalling Versa SASE Client from their devices?", options:["Always-on","Admin Disable","Tamper Protection","Fail-Close"], correctIndex:2, points:1 },
        { type:'truefalse', text:"True or False? Private App protection policies can be used to protect both pre-defined and user-defined applications.", correctBool:true, points:1 },
        { type:'mcq', text:"What would you use to block users from sharing PII or financial data using OneDrive?", options:["CASB profile","DLP profile","File Filtering","Sandboxing"], correctIndex:1, points:1 },
        { type:'multi', text:"By default, what happens when Cloud Lookup is enabled on URLF profile? (Choose Two)", options:["All URL requests will use Cloud lookup by default","All URL requests will use the in-built DB by default","All URL requests will simultaneously use in-built-DB and cloud lookup","All undefined URL will use cloud lookup"], correctIndices:[1,3], points:1 },
        { type:'mcq', text:"Which feature lets VOS inspect and do DPI (deep-packet inspection) on SSL/TLS application traffic?", options:["SSL Inspection","SSL Decryption","SASE Web Monitoring","CASB"], correctIndex:1, points:1 },
        { type:'multi', text:"Which options are available to do split tunneling from the Versa SASE Client? (Choose Two)", options:["DNS query","Application","Port","Prefixes"], correctIndices:[1,3], points:1 },
        { type:'multi', text:"Which FQDN is used for SASE Client Registration? (Choose Two)", options:["Portal FQDN","Group FQDN","SSE FQDN","Gateway FQDN"], correctIndices:[0,1], points:1 },
        { type:'multi', text:"What does blocking QUIC protocol traffic in Versa SSE achieve? (Choose Two)", options:["Forces HTTPS traffic to use TCP","App-ID detection and Other Security Features can be enforced.","Protect enterprise from having TLS tunnelling over UDP","SaaS Apps perform better after blocking QUIC"], correctIndices:[0,1], points:1 },
        { type:'mcq', text:"Easy IPS in Versa covers vulnerabilities of which CVSS range?", options:["Up to 10 years","5 to year","Up to 5 years","6 to 10 years"], correctIndex:3, points:1 },
        { type:'mcq', text:"The customer wants to block all types of upload and only PDF while downloading, for all users.", options:["ATP + DLP","CASB + File Filtering","Custom IPS signature to block PDF and ATP for all uploads","URLF to block all PDF urls and CASB"], correctIndex:1, points:1 },
        { type:'mcq', text:"Versa SSE does not support IPv6 tunnels. If DNS resolves to an IPv6 address, the traffic will bypass SSE inspection. What is the recommended solution?", options:["Enable dual-stack tunneling (IPv4 and IPv6)","Block all AAAA (IPv6) DNS records using DNS filtering","Block IPv6 traffic on SSE Gateway","Disable DNS resolution entirely"], correctIndex:1, points:1 }
      ]
    };
    const existing = await DB.getTest('sse101-seed');
    if (!existing) await DB.upsertTest(seedTest);
    await DB.setSeeded();
  } catch (e) {
    console.warn('Seed error:', e);
  }
})();
