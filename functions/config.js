/**
 * Cloudflare Pages Function: Shadowrocket 专属托管配置生成器
 * 访问路径: /config?subscription_url=你的订阅链接 (或 ?url=...)
 * 作用: 自动拉取用户的节点订阅并转换为 Shadowrocket 节点格式，
 *       并注入私有 DoH 解析服务器、IPv6 支持及完整的国内直连/国外分流规则。
 */
export async function onRequest(context) {
  const requestUrl = context.request.url;
  const urlObj = new URL(requestUrl);

  let subUrl = urlObj.searchParams.get('subscription_url') || urlObj.searchParams.get('url');

  // 容错提取：兼容未 URL 转义的原始订阅地址
  const subUrlIndex = requestUrl.indexOf('subscription_url=');
  const urlIndex = requestUrl.indexOf('url=');
  const targetIndex = subUrlIndex !== -1 ? subUrlIndex + 17 : (urlIndex !== -1 ? urlIndex + 4 : -1);

  if (targetIndex !== -1) {
    let rawSub = requestUrl.substring(targetIndex);
    try {
      subUrl = decodeURIComponent(rawSub);
    } catch {
      subUrl = rawSub;
    }
  }

  if (!subUrl) {
    return new Response('Missing required parameter: ?subscription_url= or ?url=', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 私有 DoH 地址 (主 + 备用)
  const primaryDoH = 'https://domestic-dns.114514.nowhere-backend.xyz/dns-query/a9e09e225e08d7caa10001ac';
  const backupDoH = 'https://dns-resolve.nowhere-backend.xyz/dns-query/a9e09e225e08d7caa10001ac';

  // 拉取用户的订阅内容
  let rawContent = '';
  try {
    const subResp = await fetch(subUrl, {
      headers: {
        'User-Agent': 'Shadowrocket/2182',
        'Accept': '*/*'
      }
    });

    if (!subResp.ok) {
      return new Response(`Failed to fetch subscription: ${subResp.status} ${subResp.statusText}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    rawContent = await subResp.text();
  } catch (err) {
    return new Response(`Error fetching subscription: ${err.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 解码 Base64 订阅内容
  let decoded = rawContent.trim();
  try {
    if (!decoded.startsWith('[') && !decoded.includes('://')) {
      let b64 = decoded.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binaryStr = atob(b64);
      const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
      decoded = new TextDecoder('utf-8').decode(bytes);
    }
  } catch (e) {
    // 解码失败时保持原始内容
  }

  // 解析节点
  const lines = decoded.split(/\r?\n/);
  const proxyNodes = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('STATUS=') || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    // 已经符合 Shadowrocket 格式的节点配置
    if (line.includes('=') && !line.includes('://')) {
      proxyNodes.push(line);
      continue;
    }

    // 协议 URI 解析
    const parsed = parseProxyUri(line);
    if (parsed) {
      proxyNodes.push(parsed);
    }
  }

  const nodesSection = proxyNodes.join('\n');

  // 构建完整的 Shadowrocket 托管配置文件
  const config = `[General]
dns-server = https://doh.pub/dns-query
use-local-host-item-for-proxy = true
bypass-system = true
skip-proxy = 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, localhost, *.local, captive.apple.com
tun-excluded-routes = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.88.99.0/24, 192.168.0.0/16, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 255.255.255.255/32, 239.255.255.250/32
fallback-dns-server = https://doh.pub/dns-query
proxy-dns-server = ${primaryDoH}, ${backupDoH}

# Enable full IPv6 support
ipv6 = true
prefer-ipv6 = false

# If a domain uses the direct policy, after enabling this, Shadowrocket will use the system DNS to resolve it.
dns-direct-system = false

# If true, Shadowrocket will automatically reply to ICMP packets.
icmp-auto-reply = true

# If true, Shadowrocket always executes reject urlrewrite rules even though the global routing is not config.
always-reject-url-rewrite = false

# If false, the domain resolution returns a private IP and Shadowrocket assumes that the domain is hijacked and forces the use of a proxy.
private-ip-answer = true

# If a domain uses the direct policy, automatically switch to the proxy rule if direct DNS resolution fails.
dns-direct-fallback-proxy = false

# The fallback behavior when UDP traffic matches a policy that doesn't support the UDP relay. Possible values: DIRECT, REJECT.
udp-policy-not-supported-behaviour = REJECT

# By default, DNS lookup is always performed on the remote server with a proxy policy.
# If true, Shadowrocket will use the mapped address for the proxy connection instead of the host if a local DNS mapping exists.

update-url = ${requestUrl}

[Proxy]
${nodesSection}

[Rule]
# Unbreak
# > General
DOMAIN,app.adjust.com,DIRECT
DOMAIN,app.appsflyer.com,DIRECT
DOMAIN,bdtj.tagtic.cn,DIRECT
# > Alibaba
DOMAIN,log.mmstat.com,DIRECT
DOMAIN,sycm.mmstat.com,DIRECT
# > Google
DOMAIN,safebrowsing.googleapis.com,DIRECT
DOMAIN,safebrowsing.googleapis-cn.com,DIRECT
DOMAIN,safebrowsing.clients.google.com,DIRECT
DOMAIN,safebrowsing-cache.google.com,DIRECT
# > Tencent
DOMAIN,fairplay.l.qq.com,DIRECT
DOMAIN,livew.l.qq.com,DIRECT
DOMAIN,vd.l.qq.com,DIRECT
DOMAIN,vi.l.qq.com,DIRECT
# > Strava
DOMAIN,analytics.strava.com,DIRECT
# > Umeng
DOMAIN,msg.umeng.com,DIRECT
DOMAIN,msg.umengcloud.com,DIRECT

# > YouTube
USER-AGENT,*YouTubeMusic*,PROXY
USER-AGENT,*com.google.ios.youtubemusic*,PROXY
USER-AGENT,*youtube*,PROXY
USER-AGENT,YouTube*,PROXY
USER-AGENT,YouTubeMusic*,PROXY
USER-AGENT,com.google.ios.youtube*,PROXY
USER-AGENT,com.google.ios.youtubemusic*,PROXY
DOMAIN-SUFFIX,ggpht.com,PROXY
DOMAIN-SUFFIX,googlevideo.com,PROXY
DOMAIN-SUFFIX,gvt1.com,PROXY
DOMAIN-SUFFIX,gvt2.com,PROXY
DOMAIN-SUFFIX,video.google.com,PROXY
DOMAIN-SUFFIX,wide-youtube.l.google.com,PROXY
DOMAIN-SUFFIX,withyoutube.com,PROXY
DOMAIN-SUFFIX,youtu.be,PROXY
DOMAIN-SUFFIX,youtube,PROXY
DOMAIN-SUFFIX,youtube-nocookie.com,PROXY
DOMAIN-SUFFIX,youtube-ui.l.google.com,PROXY
DOMAIN-SUFFIX,youtube.com,PROXY
DOMAIN-SUFFIX,youtube.googleapis.com,PROXY
DOMAIN-SUFFIX,youtubeeducation.com,PROXY
DOMAIN-SUFFIX,youtubeembeddedplayer.googleapis.com,PROXY
DOMAIN-SUFFIX,youtubefanfest.com,PROXY
DOMAIN-SUFFIX,youtubegaming.com,PROXY
DOMAIN-SUFFIX,youtubego.com,PROXY
DOMAIN-SUFFIX,youtubei.googleapis.com,PROXY
DOMAIN-SUFFIX,youtubekids.com,PROXY
DOMAIN-SUFFIX,youtubemobilesupport.com,PROXY
DOMAIN-SUFFIX,yt.be,PROXY
DOMAIN-SUFFIX,ytimg.com,PROXY
DOMAIN-KEYWORD,youtube,PROXY
IP-CIDR,172.110.32.0/21,PROXY,no-resolve
IP-CIDR,216.73.80.0/20,PROXY,no-resolve
IP-CIDR6,2620:120:e000::/40,PROXY,no-resolve

# > Disney+
USER-AGENT,Disney+*,PROXY
DOMAIN-SUFFIX,bam.nr-data.net,PROXY
DOMAIN-SUFFIX,bamgrid.com,PROXY
DOMAIN-SUFFIX,braze.com,PROXY
DOMAIN-SUFFIX,cdn.optimizely.com,PROXY
DOMAIN-SUFFIX,conviva.com,PROXY
DOMAIN-SUFFIX,d9.flashtalking.com,PROXY
DOMAIN-SUFFIX,disney-asia.com,PROXY
DOMAIN-SUFFIX,disney-plus.net,PROXY
DOMAIN-SUFFIX,disney.asia,PROXY
DOMAIN-SUFFIX,disney.be,PROXY
DOMAIN-SUFFIX,disney.bg,PROXY
DOMAIN-SUFFIX,disney.ca,PROXY
DOMAIN-SUFFIX,disney.ch,PROXY
DOMAIN-SUFFIX,disney.co.il,PROXY
DOMAIN-SUFFIX,disney.co.jp,PROXY
DOMAIN-SUFFIX,disney.co.kr,PROXY
DOMAIN-SUFFIX,disney.co.th,PROXY
DOMAIN-SUFFIX,disney.co.uk,PROXY
DOMAIN-SUFFIX,disney.co.za,PROXY
DOMAIN-SUFFIX,disney.com,PROXY
DOMAIN-SUFFIX,disney.com.au,PROXY
DOMAIN-SUFFIX,disney.com.br,PROXY
DOMAIN-SUFFIX,disney.com.hk,PROXY
DOMAIN-SUFFIX,disney.com.tw,PROXY
DOMAIN-SUFFIX,disney.cz,PROXY
DOMAIN-SUFFIX,disney.de,PROXY
DOMAIN-SUFFIX,disney.demdex.net,PROXY
DOMAIN-SUFFIX,disney.dk,PROXY
DOMAIN-SUFFIX,disney.es,PROXY
DOMAIN-SUFFIX,disney.fi,PROXY
DOMAIN-SUFFIX,disney.fr,PROXY
DOMAIN-SUFFIX,disney.gr,PROXY
DOMAIN-SUFFIX,disney.hu,PROXY
DOMAIN-SUFFIX,disney.id,PROXY
DOMAIN-SUFFIX,disney.in,PROXY
DOMAIN-SUFFIX,disney.io,PROXY
DOMAIN-SUFFIX,disney.it,PROXY
DOMAIN-SUFFIX,disney.my,PROXY
DOMAIN-SUFFIX,disney.nl,PROXY
DOMAIN-SUFFIX,disney.no,PROXY
DOMAIN-SUFFIX,disney.ph,PROXY
DOMAIN-SUFFIX,disney.pl,PROXY
DOMAIN-SUFFIX,disney.pt,PROXY
DOMAIN-SUFFIX,disney.ro,PROXY
DOMAIN-SUFFIX,disney.ru,PROXY
DOMAIN-SUFFIX,disney.se,PROXY
DOMAIN-SUFFIX,disney.sg,PROXY
DOMAIN-SUFFIX,disneyplus.bn5x.net,PROXY
DOMAIN-SUFFIX,disneyplus.com,PROXY
DOMAIN-SUFFIX,disneystreaming.com,PROXY
DOMAIN-SUFFIX,dssott.com,PROXY
DOMAIN-SUFFIX,dtci.co,PROXY
DOMAIN-SUFFIX,dtci.technology,PROXY
DOMAIN-SUFFIX,edgedatg.com,PROXY
DOMAIN-SUFFIX,espn.com,PROXY
DOMAIN-SUFFIX,espncdn.com,PROXY
DOMAIN-SUFFIX,hotstar.com,PROXY
DOMAIN-SUFFIX,marvel.com,PROXY
DOMAIN-SUFFIX,starott.com,PROXY
DOMAIN-SUFFIX,starplus.com,PROXY
DOMAIN-KEYWORD,disneyplus,PROXY
PROCESS-NAME,com.disney.disneyplus,PROXY

# > HBO-USA
USER-AGENT,HBOMAX*,PROXY
DOMAIN,wmff.warnermediacdn.com,PROXY
DOMAIN-SUFFIX,h264.io,PROXY
DOMAIN-SUFFIX,hbo.com,PROXY
DOMAIN-SUFFIX,hbogo.com,PROXY
DOMAIN-SUFFIX,hbonow.com,PROXY
DOMAIN-SUFFIX,hbomax.com,PROXY
DOMAIN-SUFFIX,hbomaxcdn.com,PROXY
DOMAIN-SUFFIX,max.com,PROXY
DOMAIN-SUFFIX,maxgo.com,PROXY
DOMAIN-SUFFIX,cinemax.com,PROXY
DOMAIN-SUFFIX,discomax.com,PROXY
PROCESS-NAME,com.hbo.hbonow,PROXY

# > Netflix
USER-AGENT,Argo*,PROXY
DOMAIN-SUFFIX,fast.com,PROXY
DOMAIN-SUFFIX,flxvpn.net,PROXY
DOMAIN-SUFFIX,netflix.ca,PROXY
DOMAIN-SUFFIX,netflix.com,PROXY
DOMAIN-SUFFIX,netflix.com.au,PROXY
DOMAIN-SUFFIX,netflix.net,PROXY
DOMAIN-SUFFIX,nflxext.com,PROXY
DOMAIN-SUFFIX,nflximg.com,PROXY
DOMAIN-SUFFIX,nflximg.net,PROXY
DOMAIN-SUFFIX,nflxsearch.net,PROXY
DOMAIN-SUFFIX,nflxso.net,PROXY
DOMAIN-SUFFIX,nflxvideo.net,PROXY
DOMAIN-KEYWORD,netflix,PROXY
IP-CIDR,23.246.0.0/18,PROXY,no-resolve
IP-CIDR,37.77.184.0/21,PROXY,no-resolve
IP-CIDR,45.57.0.0/17,PROXY,no-resolve
IP-CIDR,64.120.128.0/17,PROXY,no-resolve
IP-CIDR,66.197.128.0/17,PROXY,no-resolve
IP-CIDR,108.175.32.0/20,PROXY,no-resolve
IP-CIDR,192.173.64.0/18,PROXY,no-resolve
IP-CIDR,198.38.96.0/19,PROXY,no-resolve
IP-CIDR,198.45.48.0/20,PROXY,no-resolve
PROCESS-NAME,com.netflix.mediaclient,PROXY

# > Bahamut
USER-AGENT,Anime*,PROXY
DOMAIN-SUFFIX,bahamut.akamaized.net,PROXY
DOMAIN-SUFFIX,bahamut.com.tw,PROXY
DOMAIN-SUFFIX,gamer.com.tw,PROXY
DOMAIN-SUFFIX,hinet.net,PROXY

# > bilibili
USER-AGENT,*bili*,PROXY
USER-AGENT,Bilibili*,PROXY
USER-AGENT,bili*,PROXY
DOMAIN-SUFFIX,acg.tv,PROXY
DOMAIN-SUFFIX,acgvideo.com,PROXY
DOMAIN-SUFFIX,b23.tv,PROXY
DOMAIN-SUFFIX,bili22.cn,PROXY
DOMAIN-SUFFIX,bili23.cn,PROXY
DOMAIN-SUFFIX,bili33.cn,PROXY
DOMAIN-SUFFIX,biliapi.com,PROXY
DOMAIN-SUFFIX,biliapi.net,PROXY
DOMAIN-SUFFIX,bilibili.cc,PROXY
DOMAIN-SUFFIX,bilibili.cn,PROXY
DOMAIN-SUFFIX,bilibili.co,PROXY
DOMAIN-SUFFIX,bilibili.com,PROXY
DOMAIN-SUFFIX,bilibili.net,PROXY
DOMAIN-SUFFIX,bilibili.tv,PROXY
DOMAIN-SUFFIX,bilicdn1.com,PROXY
DOMAIN-SUFFIX,bilicdn2.com,PROXY
DOMAIN-SUFFIX,bilicdn3.com,PROXY
DOMAIN-SUFFIX,bilicdn4.com,PROXY
DOMAIN-SUFFIX,bilicdn5.com,PROXY
DOMAIN-SUFFIX,biligame.com,PROXY
DOMAIN-SUFFIX,biliimg.com,PROXY
DOMAIN-SUFFIX,biliintl.com,PROXY
DOMAIN-SUFFIX,biliplus.com,PROXY
DOMAIN-SUFFIX,bilivideo.cn,PROXY
DOMAIN-SUFFIX,bilivideo.com,PROXY
DOMAIN-SUFFIX,bilivideo.net,PROXY
DOMAIN-SUFFIX,hdslb.com,PROXY
DOMAIN-SUFFIX,hdslb.net,PROXY
PROCESS-NAME,com.bilibili.app.blue,PROXY
PROCESS-NAME,tv.danmaku.bili,PROXY

# > 愛奇藝台灣站
DOMAIN,cache.video.iqiyi.com,PROXY
IP-CIDR,116.211.202.206/32,PROXY,no-resolve
IP-CIDR,116.211.202.216/32,PROXY,no-resolve

# > MangoTV(芒果TV国际)
DOMAIN-SUFFIX,api.mgtv.com,PROXY
DOMAIN,mobileso.bz.mgtv.com,PROXY

# > Spotify
USER-AGENT,Spotify*,PROXY
DOMAIN,audio4-ak-spotify-com.akamaized.net,PROXY
DOMAIN-SUFFIX,audio-ak-spotify-com.akamaized.net,PROXY
DOMAIN-SUFFIX,pscdn.co,PROXY
DOMAIN-SUFFIX,scdn.co,PROXY
DOMAIN-SUFFIX,spoti.fi,PROXY
DOMAIN-SUFFIX,spotify.com,PROXY
DOMAIN-SUFFIX,spotifycdn.com,PROXY
DOMAIN-KEYWORD,-spotify-,PROXY
DOMAIN-KEYWORD,spotify.com,PROXY
PROCESS-NAME,com.spotify.music,PROXY

# > Steam
DOMAIN-SUFFIX,steam-chat.com,PROXY
DOMAIN-SUFFIX,steamcommunity.com,PROXY
DOMAIN-SUFFIX,steamgames.com,PROXY
DOMAIN-SUFFIX,steampowered.com,PROXY
DOMAIN-SUFFIX,steamstatic.com,PROXY
DOMAIN-SUFFIX,steamusercontent.com,PROXY
DOMAIN-SUFFIX,valvesoftware.com,PROXY
DOMAIN-KEYWORD,steambroadcast,PROXY
DOMAIN-KEYWORD,steamstore,PROXY
DOMAIN-KEYWORD,steamuserimages,PROXY

# > Telegram
DOMAIN-SUFFIX,t.me,PROXY
DOMAIN-SUFFIX,tdesktop.com,PROXY
DOMAIN-SUFFIX,telegra.ph,PROXY
DOMAIN-SUFFIX,telegram-cdn.org,PROXY
DOMAIN-SUFFIX,telegram.dog,PROXY
DOMAIN-SUFFIX,telegram.me,PROXY
DOMAIN-SUFFIX,telegram.org,PROXY
DOMAIN-SUFFIX,telegram.space,PROXY
DOMAIN-SUFFIX,telesco.pe,PROXY
IP-CIDR,91.108.4.0/22,PROXY,no-resolve
IP-CIDR,91.108.8.0/21,PROXY,no-resolve
IP-CIDR,91.108.12.0/22,PROXY,no-resolve
IP-CIDR,91.108.16.0/22,PROXY,no-resolve
IP-CIDR,91.108.56.0/22,PROXY,no-resolve
IP-CIDR,149.154.160.0/20,PROXY,no-resolve
IP-CIDR6,2001:67c:4e8::/48,PROXY,no-resolve
IP-CIDR6,2001:b28:f23d::/48,PROXY,no-resolve
IP-CIDR6,2001:b28:f23f::/48,PROXY,no-resolve
IP-ASN,211157,PROXY,no-resolve
IP-ASN,44907,PROXY,no-resolve
IP-ASN,59930,PROXY,no-resolve
IP-ASN,62014,PROXY,no-resolve
IP-ASN,62041,PROXY,no-resolve
PROCESS-NAME,telegram-desktop,PROXY

# > Google
DOMAIN-SUFFIX,1e100.net,PROXY
DOMAIN-SUFFIX,android.com,PROXY
DOMAIN-SUFFIX,blogger.com,PROXY
DOMAIN-SUFFIX,blogspot.com,PROXY
DOMAIN-SUFFIX,chrome.com,PROXY
DOMAIN-SUFFIX,chromium.org,PROXY
DOMAIN-SUFFIX,deepmind.com,PROXY
DOMAIN-SUFFIX,firebaseio.com,PROXY
DOMAIN-SUFFIX,g.co,PROXY
DOMAIN-SUFFIX,ggpht.com,PROXY
DOMAIN-SUFFIX,gmail.com,PROXY
DOMAIN-SUFFIX,google.com,PROXY
DOMAIN-SUFFIX,google.com.hk,PROXY
DOMAIN-SUFFIX,googleadservices.com,PROXY
DOMAIN-SUFFIX,googleapis.com,PROXY
DOMAIN-SUFFIX,googlesyndication.com,PROXY
DOMAIN-SUFFIX,googletagmanager.com,PROXY
DOMAIN-SUFFIX,googleusercontent.com,PROXY
DOMAIN-SUFFIX,gstatic.com,PROXY
DOMAIN-SUFFIX,gvt1.com,PROXY
DOMAIN-KEYWORD,google,PROXY
DOMAIN-KEYWORD,gmail,PROXY
IP-CIDR,173.194.0.0/16,PROXY,no-resolve
IP-CIDR,74.125.0.0/16,PROXY,no-resolve

# > Microsoft
DOMAIN-SUFFIX,bing.com,PROXY
DOMAIN-SUFFIX,cn.bing.com,PROXY
DOMAIN-SUFFIX,bing.net,PROXY
DOMAIN-SUFFIX,bingapis.com,PROXY
DOMAIN-SUFFIX,microsoft.com,PROXY
DOMAIN-SUFFIX,microsoftonline.com,PROXY
DOMAIN-SUFFIX,office.com,PROXY
DOMAIN-SUFFIX,office365.com,PROXY
DOMAIN-SUFFIX,windows.com,PROXY
DOMAIN-SUFFIX,windowsupdate.com,PROXY
DOMAIN-SUFFIX,live.com,PROXY
DOMAIN-SUFFIX,msn.com,PROXY
DOMAIN-SUFFIX,outlook.com,PROXY
DOMAIN-SUFFIX,onedrive.com,PROXY
DOMAIN-SUFFIX,sharepoint.com,PROXY
DOMAIN-SUFFIX,azure.com,PROXY
DOMAIN-SUFFIX,msftauth.net,PROXY
DOMAIN-SUFFIX,msauth.net,PROXY
DOMAIN-KEYWORD,microsoft,PROXY
DOMAIN-KEYWORD,onedrive,PROXY

# > AI
DOMAIN,anthropic.auth0.com,PROXY
DOMAIN-SUFFIX,anthropic.com,PROXY
DOMAIN-SUFFIX,claude.ai,PROXY
DOMAIN-SUFFIX,claude.com,PROXY
DOMAIN-SUFFIX,clau.de,PROXY
DOMAIN-SUFFIX,claudeusercontent.com,PROXY
DOMAIN,gemini.google.com,PROXY
DOMAIN-SUFFIX,generativelanguage.googleapis.com,PROXY
DOMAIN-SUFFIX,githubcopilot.com,PROXY
DOMAIN-SUFFIX,cursor.sh,PROXY
DOMAIN-SUFFIX,cursor.com,PROXY
DOMAIN-SUFFIX,perplexity.ai,PROXY
DOMAIN-SUFFIX,x.ai,PROXY
DOMAIN-SUFFIX,openai.com,PROXY
DOMAIN-SUFFIX,chatgpt.com,PROXY
DOMAIN-SUFFIX,oaistatic.com,PROXY
DOMAIN-SUFFIX,oaiusercontent.com,PROXY
DOMAIN-KEYWORD,openai,PROXY
DOMAIN-KEYWORD,anthropic,PROXY
IP-ASN,399358,PROXY,no-resolve

# > Apple Intelligence
DOMAIN-SUFFIX,apple-relay.apple.com,PROXY
DOMAIN-SUFFIX,apple-relay.cloudflare.com,PROXY
DOMAIN-SUFFIX,gateway.icloud.com,PROXY

# > PayPal
DOMAIN-SUFFIX,paypal.com,PROXY
DOMAIN-SUFFIX,paypal.me,PROXY
DOMAIN-SUFFIX,paypalobjects.com,PROXY
DOMAIN-KEYWORD,paypal,PROXY

# > Apple
DOMAIN-SUFFIX,aaplimg.com,PROXY
DOMAIN-SUFFIX,apple.co,PROXY
DOMAIN-SUFFIX,apple.com,PROXY
DOMAIN-SUFFIX,apple-cloudkit.com,PROXY
DOMAIN-SUFFIX,appstore.com,PROXY
DOMAIN-SUFFIX,cdn-apple.com,PROXY
DOMAIN-SUFFIX,icloud.com,PROXY
DOMAIN-SUFFIX,icloud-content.com,PROXY
DOMAIN-SUFFIX,me.com,PROXY
DOMAIN-SUFFIX,mzstatic.com,PROXY
IP-CIDR,17.0.0.0/8,PROXY,no-resolve

# > Amazon
DOMAIN-SUFFIX,amazon.com,PROXY
DOMAIN-SUFFIX,amazonaws.com,PROXY
DOMAIN-SUFFIX,primevideo.com,PROXY

# > Meta (Facebook / Instagram / WhatsApp)
DOMAIN-SUFFIX,facebook.com,PROXY
DOMAIN-SUFFIX,fb.com,PROXY
DOMAIN-SUFFIX,fbcdn.net,PROXY
DOMAIN-SUFFIX,instagram.com,PROXY
DOMAIN-SUFFIX,cdninstagram.com,PROXY
DOMAIN-SUFFIX,threads.net,PROXY
DOMAIN-SUFFIX,whatsapp.com,PROXY
DOMAIN-SUFFIX,whatsapp.net,PROXY
DOMAIN-KEYWORD,facebook,PROXY
DOMAIN-KEYWORD,instagram,PROXY

# > Twitter / X
DOMAIN-SUFFIX,twitter.com,PROXY
DOMAIN-SUFFIX,x.com,PROXY
DOMAIN-SUFFIX,t.co,PROXY
DOMAIN-SUFFIX,twimg.com,PROXY
DOMAIN-KEYWORD,twitter,PROXY

# > Other Services
DOMAIN-SUFFIX,discord.com,PROXY
DOMAIN-SUFFIX,discord.gg,PROXY
DOMAIN-SUFFIX,dropbox.com,PROXY
DOMAIN-SUFFIX,medium.com,PROXY
DOMAIN-SUFFIX,reddit.com,PROXY
DOMAIN-SUFFIX,redd.it,PROXY
DOMAIN-SUFFIX,v2ex.com,PROXY
DOMAIN-SUFFIX,wikipedia.org,PROXY
DOMAIN-SUFFIX,wikimedia.org,PROXY
DOMAIN-SUFFIX,yahoo.com,PROXY

# China Area Network (Direct)
DOMAIN-SUFFIX,amap.com,DIRECT
DOMAIN-SUFFIX,autonavi.com,DIRECT
DOMAIN-SUFFIX,baidu.com,DIRECT
DOMAIN-SUFFIX,bdstatic.com,DIRECT
DOMAIN-SUFFIX,taobao.com,DIRECT
DOMAIN-SUFFIX,alipay.com,DIRECT
DOMAIN-SUFFIX,alibaba.com,DIRECT
DOMAIN-SUFFIX,alicdn.com,DIRECT
DOMAIN-SUFFIX,qq.com,DIRECT
DOMAIN-SUFFIX,tencent.com,DIRECT
DOMAIN-SUFFIX,weixin.com,DIRECT
DOMAIN-SUFFIX,wechat.com,DIRECT
DOMAIN-SUFFIX,jd.com,DIRECT
DOMAIN-SUFFIX,163.com,DIRECT
DOMAIN-SUFFIX,126.net,DIRECT
DOMAIN-SUFFIX,sina.com.cn,DIRECT
DOMAIN-SUFFIX,weibo.com,DIRECT
DOMAIN-SUFFIX,zhihu.com,DIRECT
DOMAIN-SUFFIX,douban.com,DIRECT
DOMAIN-SUFFIX,meituan.com,DIRECT
DOMAIN-SUFFIX,pinduoduo.com,DIRECT
DOMAIN-SUFFIX,kuaishou.com,DIRECT
DOMAIN-SUFFIX,douyin.com,DIRECT
DOMAIN-SUFFIX,bytedance.com,DIRECT
DOMAIN-SUFFIX,xiaomi.com,DIRECT
DOMAIN-SUFFIX,huawei.com,DIRECT

# Outlook & WSUS Direct
DOMAIN,outlook.office365.com,DIRECT
DOMAIN,smtp-mail.outlook.com,DIRECT
DOMAIN,smtp.office365.com,DIRECT
DOMAIN-SUFFIX,windowsupdate.com,DIRECT
DOMAIN-SUFFIX,windowsupdate.microsoft.com,DIRECT

# Tencent Direct
IP-CIDR,182.254.116.0/24,DIRECT,no-resolve
IP-CIDR,203.205.238.0/23,DIRECT,no-resolve
IP-CIDR,203.205.254.0/23,DIRECT,no-resolve

# Local & LAN
DOMAIN-SUFFIX,local,DIRECT
IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
IP-CIDR,100.64.0.0/10,DIRECT,no-resolve
IP-CIDR6,::1/128,DIRECT,no-resolve
IP-CIDR6,fc00::/7,DIRECT,no-resolve
IP-CIDR6,fe80::/10,DIRECT,no-resolve
IP-CIDR6,fd00::/8,DIRECT,no-resolve

# GeoIP CN
GEOIP,CN,DIRECT
FINAL,PROXY

[URL Rewrite]
^https?://(www.)?g.cn($|/.*) https://www.google.com$2 302
^https?://(www.)?google.cn($|/.*) https://www.google.com$2 302
`;

  return new Response(config, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="Shadowrocket.conf"',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * 协议 URI 转 Shadowrocket 节点配置
 */
function parseProxyUri(uri) {
  if (uri.startsWith('anytls://')) {
    return parseAnytls(uri);
  }
  if (uri.startsWith('trojan://')) {
    return parseTrojan(uri);
  }
  if (uri.startsWith('ss://')) {
    return parseSS(uri);
  }
  if (uri.startsWith('vmess://')) {
    return parseVmess(uri);
  }
  if (uri.startsWith('vless://')) {
    return parseVless(uri);
  }
  if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) {
    return parseHysteria2(uri);
  }
  return null;
}

function parseAnytls(uri) {
  try {
    const hashIdx = uri.indexOf('#');
    const rawName = hashIdx !== -1 ? uri.substring(hashIdx + 1) : '';
    const cleanUri = hashIdx !== -1 ? uri.substring(0, hashIdx) : uri;
    const name = decodeURIComponent(rawName) || 'AnyTLS';

    const u = new URL(cleanUri);
    const password = u.username ? decodeURIComponent(u.username) : '';
    const host = u.hostname;
    const port = u.port || '443';
    const sni = u.searchParams.get('sni') || host;
    const insecure = u.searchParams.get('insecure') === '1';

    return `${name} = anytls, ${host}, ${port}, password=${password}, tls=true, sni=${sni}, skip-cert-verify=${insecure}, udp-relay=true`;
  } catch {
    return null;
  }
}

function parseTrojan(uri) {
  try {
    const hashIdx = uri.indexOf('#');
    const rawName = hashIdx !== -1 ? uri.substring(hashIdx + 1) : '';
    const cleanUri = hashIdx !== -1 ? uri.substring(0, hashIdx) : uri;
    const name = decodeURIComponent(rawName) || 'Trojan';

    const u = new URL(cleanUri);
    const password = u.username ? decodeURIComponent(u.username) : '';
    const host = u.hostname;
    const port = u.port || '443';
    const sni = u.searchParams.get('sni') || u.searchParams.get('peer') || host;
    const insecure = u.searchParams.get('allowInsecure') === '1' || u.searchParams.get('insecure') === '1';

    return `${name} = trojan, ${host}, ${port}, password=${password}, tls=true, sni=${sni}, skip-cert-verify=${insecure}, udp-relay=true`;
  } catch {
    return null;
  }
}

function parseSS(uri) {
  try {
    const hashIdx = uri.indexOf('#');
    const rawName = hashIdx !== -1 ? uri.substring(hashIdx + 1) : '';
    const body = hashIdx !== -1 ? uri.substring(5, hashIdx) : uri.substring(5);
    const name = decodeURIComponent(rawName) || 'Shadowsocks';

    let method = '', password = '', host = '', port = '';
    if (body.includes('@')) {
      const atIdx = body.lastIndexOf('@');
      const userinfoB64 = body.substring(0, atIdx);
      const hostPort = body.substring(atIdx + 1);
      const [h, p] = hostPort.split(':');
      host = h;
      port = p ? p.split('/')[0] : '8388';
      const decoded = atob(userinfoB64);
      const colonIdx = decoded.indexOf(':');
      method = decoded.substring(0, colonIdx);
      password = decoded.substring(colonIdx + 1);
    } else {
      let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const decoded = atob(b64);
      const atIdx = decoded.lastIndexOf('@');
      if (atIdx !== -1) {
        const userinfo = decoded.substring(0, atIdx);
        const hostPort = decoded.substring(atIdx + 1);
        const colonIdx = userinfo.indexOf(':');
        method = userinfo.substring(0, colonIdx);
        password = userinfo.substring(colonIdx + 1);
        const [h, p] = hostPort.split(':');
        host = h;
        port = p;
      }
    }
    if (!host || !port) return null;
    return `${name} = custom, ${host}, ${port}, ${method}, ${password}, udp-relay=true`;
  } catch {
    return null;
  }
}

function parseVmess(uri) {
  try {
    const b64 = uri.substring(8);
    let padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) padded += '=';
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    const v = JSON.parse(jsonStr);

    const name = v.ps || 'VMess';
    const host = v.add;
    const port = v.port;
    const uuid = v.id;
    const alterId = v.aid || 0;
    const net = v.net || 'tcp';
    const hostHeader = v.host || '';
    const path = v.path || '';
    const tls = v.tls === 'tls';

    let parts = [`${name} = vmess`, host, port, `username=${uuid}`, `alterId=${alterId}`];
    if (tls) parts.push('tls=true');
    if (v.sni) parts.push(`sni=${v.sni}`);
    if (net === 'ws') {
      parts.push('ws=true');
      if (path) parts.push(`ws-path=${path}`);
      if (hostHeader) parts.push(`ws-headers="Host: ${hostHeader}"`);
    }
    parts.push('udp-relay=true');
    return parts.join(', ');
  } catch {
    return null;
  }
}

function parseVless(uri) {
  try {
    const hashIdx = uri.indexOf('#');
    const rawName = hashIdx !== -1 ? uri.substring(hashIdx + 1) : '';
    const cleanUri = hashIdx !== -1 ? uri.substring(0, hashIdx) : uri;
    const name = decodeURIComponent(rawName) || 'VLESS';

    const u = new URL(cleanUri);
    const uuid = u.username ? decodeURIComponent(u.username) : '';
    const host = u.hostname;
    const port = u.port || '443';
    const type = u.searchParams.get('type') || 'tcp';
    const security = u.searchParams.get('security') || 'none';
    const sni = u.searchParams.get('sni') || host;
    const path = u.searchParams.get('path') || '';

    let parts = [`${name} = vless`, host, port, `username=${uuid}`];
    if (security === 'tls' || security === 'reality') parts.push('tls=true');
    if (sni) parts.push(`sni=${sni}`);
    if (type === 'ws') {
      parts.push('ws=true');
      if (path) parts.push(`ws-path=${path}`);
    }
    parts.push('udp-relay=true');
    return parts.join(', ');
  } catch {
    return null;
  }
}

function parseHysteria2(uri) {
  try {
    const hashIdx = uri.indexOf('#');
    const rawName = hashIdx !== -1 ? uri.substring(hashIdx + 1) : '';
    const cleanUri = hashIdx !== -1 ? uri.substring(0, hashIdx) : uri;
    const name = decodeURIComponent(rawName) || 'Hysteria2';

    const u = new URL(cleanUri);
    const password = u.username ? decodeURIComponent(u.username) : '';
    const host = u.hostname;
    const port = u.port || '443';
    const sni = u.searchParams.get('sni') || host;
    const insecure = u.searchParams.get('insecure') === '1';

    return `${name} = hysteria2, ${host}, ${port}, password=${password}, sni=${sni}, skip-cert-verify=${insecure}, udp-relay=true`;
  } catch {
    return null;
  }
}
