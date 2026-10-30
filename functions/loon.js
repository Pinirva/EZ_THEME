/**
 * Cloudflare Pages Function: Loon 专属托管配置生成器
 * 访问路径: /loon?url=你的订阅链接 (或 ?subscription_url=...)
 * 作用: 自动将用户的节点订阅接入 Loon 完整的策略组与分流规则，并注入私有 DoH 解析服务器
 */
export async function onRequest(context) {
  const requestUrl = context.request.url;
  const urlObj = new URL(requestUrl);

  let subUrl = urlObj.searchParams.get('url') || urlObj.searchParams.get('subscription_url');
  let siteName = urlObj.searchParams.get('name') || 'config';

  // 容错提取：兼容未 URL 转义的原始订阅地址
  const urlIndex = requestUrl.indexOf('url=');
  const subUrlIndex = requestUrl.indexOf('subscription_url=');
  const targetIndex = subUrlIndex !== -1 ? subUrlIndex + 17 : (urlIndex !== -1 ? urlIndex + 4 : -1);

  if (targetIndex !== -1) {
    let rawSub = requestUrl.substring(targetIndex);
    const nameIndex = rawSub.indexOf('&name=');
    if (nameIndex !== -1) {
      siteName = decodeURIComponent(rawSub.substring(nameIndex + 6)) || siteName;
      rawSub = rawSub.substring(0, nameIndex);
    }
    try {
      subUrl = decodeURIComponent(rawSub);
    } catch {
      subUrl = rawSub;
    }
  }

  if (!subUrl) {
    return new Response('Missing required parameter: ?url= or ?subscription_url=', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 私有 DoH 地址
  const primaryDoH = 'https://domestic-dns.114514.nowhere-backend.xyz/dns-query/a9e09e225e08d7caa10001ac';
  const backupDoH = 'https://dns-resolve.nowhere-backend.xyz/dns-query/a9e09e225e08d7caa10001ac';

  const loonConfig = `[General]
ipv6 = true
ip-mode = dual
dns-server = system
allow-udp-proxy = true
bypass-tun = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local

[Remote Proxy]
# 订阅节点引入：自动应用私有 DoH 解析服务器
${siteName} = ${subUrl}, parser-enabled=true, server-dns="${primaryDoH},${backupDoH}", enabled=true

[Proxy Group]
🚀 节点选择 = select, ♻️ 自动选择, DIRECT, ${siteName}
🎬 国外媒体 = select, 🚀 节点选择, DIRECT
🤖 海外AI = select, 🚀 节点选择
📲 电报消息 = select, 🚀 节点选择
🔍 谷歌服务 = select, 🚀 节点选择
📎 微软服务 = select, DIRECT, 🚀 节点选择
🍎 苹果服务 = select, DIRECT, 🚀 节点选择
🎮 Steam = select, 🚀 节点选择, DIRECT
🛡️ 广告拦截 = select, REJECT, DIRECT
🐟 漏网之鱼 = select, 🚀 节点选择, DIRECT
♻️ 自动选择 = url-test, ${siteName}, url = http://www.apple.com/library/test/success.html, interval = 300, tolerance = 50

[Rule]
# ─── 广告拦截 ───
DOMAIN-KEYWORD,admarvel,🛡️ 广告拦截
DOMAIN-KEYWORD,admaster,🛡️ 广告拦截
DOMAIN-KEYWORD,adsage,🛡️ 广告拦截
DOMAIN-KEYWORD,adsmogo,🛡️ 广告拦截
DOMAIN-KEYWORD,adsrvmedia,🛡️ 广告拦截
DOMAIN-KEYWORD,adwords,🛡️ 广告拦截
DOMAIN-KEYWORD,adservice,🛡️ 广告拦截
DOMAIN-KEYWORD,domob,🛡️ 广告拦截
DOMAIN-KEYWORD,duomeng,🛡️ 广告拦截
DOMAIN-KEYWORD,dwtrack,🛡️ 广告拦截
DOMAIN-KEYWORD,guanggao,🛡️ 广告拦截
DOMAIN-KEYWORD,lianmeng,🛡️ 广告拦截
DOMAIN-KEYWORD,omgmta,🛡️ 广告拦截
DOMAIN-KEYWORD,openx,🛡️ 广告拦截
DOMAIN-KEYWORD,partnerad,🛡️ 广告拦截
DOMAIN-KEYWORD,supersonicads,🛡️ 广告拦截
DOMAIN-KEYWORD,umeng,🛡️ 广告拦截
DOMAIN-KEYWORD,zjtoolbar,🛡️ 广告拦截
DOMAIN-SUFFIX,appsflyer.com,🛡️ 广告拦截
DOMAIN-SUFFIX,doubleclick.net,🛡️ 广告拦截
DOMAIN-SUFFIX,mmstat.com,🛡️ 广告拦截

# ─── WebRTC/STUN 防泄露 ───
DOMAIN-KEYWORD,stun,🚀 节点选择
DOMAIN-SUFFIX,stun.l.google.com,🚀 节点选择
DOMAIN-SUFFIX,stun.qq.com,🚀 节点选择

# ─── 局域网 ───
DOMAIN-SUFFIX,local,DIRECT
DOMAIN-SUFFIX,localhost,DIRECT
IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
IP-CIDR,17.0.0.0/8,DIRECT,no-resolve
IP-CIDR,100.64.0.0/10,DIRECT,no-resolve
IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
IP-CIDR,198.18.0.0/16,DIRECT,no-resolve
IP-CIDR,224.0.0.0/4,DIRECT,no-resolve
IP-CIDR6,::1/128,DIRECT,no-resolve
IP-CIDR6,fc00::/7,DIRECT,no-resolve
IP-CIDR6,fe80::/10,DIRECT,no-resolve

# ─── 海外 AI ───
DOMAIN-SUFFIX,openai.com,🤖 海外AI
DOMAIN-SUFFIX,chatgpt.com,🤖 海外AI
DOMAIN-SUFFIX,oaiusercontent.com,🤖 海外AI
DOMAIN-SUFFIX,oaistatic.com,🤖 海外AI
DOMAIN-SUFFIX,auth0.com,🤖 海外AI
DOMAIN-SUFFIX,challenges.cloudflare.com,🤖 海外AI
DOMAIN-SUFFIX,anthropic.com,🤖 海外AI
DOMAIN-SUFFIX,claude.ai,🤖 海外AI
DOMAIN-SUFFIX,bard.google.com,🤖 海外AI
DOMAIN-SUFFIX,gemini.google.com,🤖 海外AI
DOMAIN-SUFFIX,aistudio.google.com,🤖 海外AI
DOMAIN-SUFFIX,deepmind.com,🤖 海外AI
DOMAIN-SUFFIX,deepmind.google,🤖 海外AI
DOMAIN-SUFFIX,generativelanguage.googleapis.com,🤖 海外AI
DOMAIN-SUFFIX,copilot.microsoft.com,🤖 海外AI
DOMAIN-SUFFIX,perplexity.ai,🤖 海外AI
DOMAIN-SUFFIX,poe.com,🤖 海外AI
DOMAIN-SUFFIX,suno.ai,🤖 海外AI
DOMAIN-SUFFIX,suno.com,🤖 海外AI
DOMAIN-SUFFIX,midjourney.com,🤖 海外AI
DOMAIN-SUFFIX,cohere.com,🤖 海外AI
DOMAIN-SUFFIX,huggingface.co,🤖 海外AI
DOMAIN-SUFFIX,replicate.com,🤖 海外AI
DOMAIN-SUFFIX,cursor.sh,🤖 海外AI
DOMAIN-SUFFIX,cursor.com,🤖 海外AI
DOMAIN-KEYWORD,openai,🤖 海外AI
DOMAIN-KEYWORD,anthropic,🤖 海外AI

# ─── GitHub ───
DOMAIN-SUFFIX,github.com,🚀 节点选择
DOMAIN-SUFFIX,github.io,🚀 节点选择
DOMAIN-SUFFIX,githubapp.com,🚀 节点选择
DOMAIN-SUFFIX,githubassets.com,🚀 节点选择
DOMAIN-SUFFIX,githubusercontent.com,🚀 节点选择
DOMAIN-SUFFIX,ghcr.io,🚀 节点选择
DOMAIN-SUFFIX,github.dev,🚀 节点选择

# ─── Telegram ───
DOMAIN-SUFFIX,t.me,📲 电报消息
DOMAIN-SUFFIX,tdesktop.com,📲 电报消息
DOMAIN-SUFFIX,telegra.ph,📲 电报消息
DOMAIN-SUFFIX,telegram.me,📲 电报消息
DOMAIN-SUFFIX,telegram.org,📲 电报消息
DOMAIN-SUFFIX,telesco.pe,📲 电报消息
IP-CIDR,91.108.4.0/22,📲 电报消息,no-resolve
IP-CIDR,91.108.8.0/21,📲 电报消息,no-resolve
IP-CIDR,91.108.12.0/22,📲 电报消息,no-resolve
IP-CIDR,91.108.16.0/22,📲 电报消息,no-resolve
IP-CIDR,91.108.56.0/22,📲 电报消息,no-resolve
IP-CIDR,149.154.160.0/20,📲 电报消息,no-resolve
IP-CIDR6,2001:67c:4e8::/48,📲 电报消息,no-resolve
IP-CIDR6,2001:b28:f23d::/48,📲 电报消息,no-resolve
IP-CIDR6,2001:b28:f23f::/48,📲 电报消息,no-resolve

# ─── YouTube ───
DOMAIN-SUFFIX,youtube.com,🎬 国外媒体
DOMAIN-SUFFIX,youtu.be,🎬 国外媒体
DOMAIN-SUFFIX,ytimg.com,🎬 国外媒体
DOMAIN-SUFFIX,yt.be,🎬 国外媒体
DOMAIN-SUFFIX,googlevideo.com,🎬 国外媒体
DOMAIN-SUFFIX,yt3.ggpht.com,🎬 国外媒体
DOMAIN-KEYWORD,youtube,🎬 国外媒体

# ─── Netflix ───
DOMAIN-SUFFIX,netflix.com,🎬 国外媒体
DOMAIN-SUFFIX,netflix.net,🎬 国外媒体
DOMAIN-SUFFIX,nflximg.com,🎬 国外媒体
DOMAIN-SUFFIX,nflximg.net,🎬 国外媒体
DOMAIN-SUFFIX,nflxvideo.net,🎬 国外媒体
DOMAIN-SUFFIX,nflxso.net,🎬 国外媒体
DOMAIN-SUFFIX,nflxext.com,🎬 国外媒体
DOMAIN-KEYWORD,netflix,🎬 国外媒体
IP-CIDR,23.246.0.0/18,🎬 国外媒体,no-resolve
IP-CIDR,37.77.184.0/21,🎬 国外媒体,no-resolve
IP-CIDR,45.57.0.0/17,🎬 国外媒体,no-resolve
IP-CIDR,64.120.128.0/17,🎬 国外媒体,no-resolve
IP-CIDR,66.197.128.0/17,🎬 国外媒体,no-resolve
IP-CIDR,108.175.32.0/20,🎬 国外媒体,no-resolve
IP-CIDR,192.173.64.0/18,🎬 国外媒体,no-resolve
IP-CIDR,198.38.96.0/19,🎬 国外媒体,no-resolve
IP-CIDR,198.45.48.0/20,🎬 国外媒体,no-resolve

# ─── Disney+ ───
DOMAIN-SUFFIX,disney.com,🎬 国外媒体
DOMAIN-SUFFIX,disneyplus.com,🎬 国外媒体
DOMAIN-SUFFIX,disney-plus.net,🎬 国外媒体
DOMAIN-SUFFIX,disneystreaming.com,🎬 国外媒体
DOMAIN-SUFFIX,dssott.com,🎬 国外媒体
DOMAIN-SUFFIX,bamgrid.com,🎬 国外媒体
DOMAIN-SUFFIX,starott.com,🎬 国外媒体
DOMAIN-SUFFIX,d9cleaning.com,🎬 国外媒体
DOMAIN-KEYWORD,disneyplus,🎬 国外媒体

# ─── Spotify ───
DOMAIN-SUFFIX,spotify.com,🎬 国外媒体
DOMAIN-SUFFIX,spotifycdn.com,🎬 国外媒体
DOMAIN-SUFFIX,scdn.co,🎬 国外媒体
DOMAIN-SUFFIX,pscdn.co,🎬 国外媒体
DOMAIN-SUFFIX,audio-ak-spotify-com.akamaized.net,🎬 国外媒体
DOMAIN-KEYWORD,spotify,🎬 国外媒体

# ─── 推特 / X ───
DOMAIN-SUFFIX,twitter.com,🚀 节点选择
DOMAIN-SUFFIX,x.com,🚀 节点选择
DOMAIN-SUFFIX,t.co,🚀 节点选择
DOMAIN-SUFFIX,twimg.com,🚀 节点选择
DOMAIN-SUFFIX,tweetdeck.com,🚀 节点选择
DOMAIN-SUFFIX,twittercommunity.com,🚀 节点选择
DOMAIN-KEYWORD,twitter,🚀 节点选择

# ─── Facebook / Instagram / Meta ───
DOMAIN-SUFFIX,facebook.com,🚀 节点选择
DOMAIN-SUFFIX,fb.com,🚀 节点选择
DOMAIN-SUFFIX,fb.me,🚀 节点选择
DOMAIN-SUFFIX,fbcdn.net,🚀 节点选择
DOMAIN-SUFFIX,fbsbx.com,🚀 节点选择
DOMAIN-SUFFIX,instagram.com,🚀 节点选择
DOMAIN-SUFFIX,cdninstagram.com,🚀 节点选择
DOMAIN-SUFFIX,threads.net,🚀 节点选择
DOMAIN-SUFFIX,whatsapp.com,🚀 节点选择
DOMAIN-SUFFIX,whatsapp.net,🚀 节点选择
DOMAIN-SUFFIX,meta.com,🚀 节点选择
DOMAIN-KEYWORD,facebook,🚀 节点选择
DOMAIN-KEYWORD,instagram,🚀 节点选择

# ─── 谷歌服务 ───
DOMAIN-SUFFIX,google.com,🔍 谷歌服务
DOMAIN-SUFFIX,google.com.hk,🔍 谷歌服务
DOMAIN-SUFFIX,googleapis.com,🔍 谷歌服务
DOMAIN-SUFFIX,googleapis.cn,🔍 谷歌服务
DOMAIN-SUFFIX,gstatic.com,🔍 谷歌服务
DOMAIN-SUFFIX,ggpht.com,🔍 谷歌服务
DOMAIN-SUFFIX,googleusercontent.com,🔍 谷歌服务
DOMAIN-SUFFIX,google.cn,🔍 谷歌服务
DOMAIN-SUFFIX,google-analytics.com,🔍 谷歌服务
DOMAIN-SUFFIX,googleadservices.com,🔍 谷歌服务
DOMAIN-SUFFIX,googletagmanager.com,🔍 谷歌服务
DOMAIN-SUFFIX,googletagservices.com,🔍 谷歌服务
DOMAIN-SUFFIX,gmail.com,🔍 谷歌服务
DOMAIN-SUFFIX,googlemail.com,🔍 谷歌服务
DOMAIN-SUFFIX,googlesyndication.com,🔍 谷歌服务
DOMAIN-SUFFIX,google.ad,🔍 谷歌服务
DOMAIN-KEYWORD,google,🔍 谷歌服务
DOMAIN-KEYWORD,gmail,🔍 谷歌服务

# ─── Steam ───
DOMAIN-SUFFIX,steamcommunity.com,🎮 Steam
DOMAIN-SUFFIX,steampowered.com,🎮 Steam
DOMAIN-SUFFIX,steamstatic.com,🎮 Steam
DOMAIN-SUFFIX,steamusercontent.com,🎮 Steam
DOMAIN-SUFFIX,steamcontent.com,🎮 Steam
DOMAIN-SUFFIX,steam-chat.com,🎮 Steam
DOMAIN-SUFFIX,steamgames.com,🎮 Steam
DOMAIN-SUFFIX,steambroadcast.akamaized.net,🎮 Steam

# ─── 微软服务 ───
DOMAIN-SUFFIX,bing.com,📎 微软服务
DOMAIN-SUFFIX,cn.bing.com,📎 微软服务
DOMAIN-SUFFIX,bing.net,📎 微软服务
DOMAIN-SUFFIX,bingapis.com,📎 微软服务
DOMAIN-SUFFIX,microsoft.com,📎 微软服务
DOMAIN-SUFFIX,microsoftonline.com,📎 微软服务
DOMAIN-SUFFIX,office.com,📎 微软服务
DOMAIN-SUFFIX,office365.com,📎 微软服务
DOMAIN-SUFFIX,windows.com,📎 微软服务
DOMAIN-SUFFIX,windowsupdate.com,📎 微软服务
DOMAIN-SUFFIX,live.com,📎 微软服务
DOMAIN-SUFFIX,msn.com,📎 微软服务
DOMAIN-SUFFIX,outlook.com,📎 微软服务
DOMAIN-SUFFIX,onedrive.com,📎 微软服务
DOMAIN-SUFFIX,sharepoint.com,📎 微软服务
DOMAIN-SUFFIX,teams.microsoft.com,📎 微软服务
DOMAIN-SUFFIX,azure.com,📎 微软服务
DOMAIN-SUFFIX,msftauth.net,📎 微软服务
DOMAIN-SUFFIX,msauth.net,📎 微软服务
DOMAIN-SUFFIX,msauthimages.net,📎 微软服务
DOMAIN-SUFFIX,officecdn.microsoft.com,📎 微软服务
DOMAIN-KEYWORD,officecdn,📎 微软服务

# ─── 苹果服务 ───
DOMAIN-SUFFIX,apps.apple.com,🍎 苹果服务
DOMAIN-SUFFIX,itunes.apple.com,🍎 苹果服务
DOMAIN-SUFFIX,blobstore.apple.com,🍎 苹果服务
DOMAIN,safebrowsing.urlsec.qq.com,🍎 苹果服务
DOMAIN-SUFFIX,apple.com,🍎 苹果服务
DOMAIN-SUFFIX,apple-cloudkit.com,🍎 苹果服务
DOMAIN-SUFFIX,icloud.com,🍎 苹果服务
DOMAIN-SUFFIX,icloud-content.com,🍎 苹果服务
DOMAIN-SUFFIX,mzstatic.com,🍎 苹果服务
DOMAIN-SUFFIX,aaplimg.com,🍎 苹果服务
DOMAIN-SUFFIX,cdn-apple.com,🍎 苹果服务
DOMAIN-SUFFIX,akadns.net,🍎 苹果服务

# ─── 国外媒体(其他) ───
DOMAIN-SUFFIX,twitch.tv,🎬 国外媒体
DOMAIN-SUFFIX,ttvnw.net,🎬 国外媒体
DOMAIN-SUFFIX,jtvnw.net,🎬 国外媒体
DOMAIN-SUFFIX,hbo.com,🎬 国外媒体
DOMAIN-SUFFIX,hbomax.com,🎬 国外媒体
DOMAIN-SUFFIX,primevideo.com,🎬 国外媒体
DOMAIN-SUFFIX,vimeo.com,🎬 国外媒体
DOMAIN-SUFFIX,dailymotion.com,🎬 国外媒体
DOMAIN-SUFFIX,soundcloud.com,🎬 国外媒体
DOMAIN-SUFFIX,tidal.com,🎬 国外媒体
DOMAIN-SUFFIX,deezer.com,🎬 国外媒体
DOMAIN-SUFFIX,pandora.com,🎬 国外媒体
DOMAIN-SUFFIX,hulu.com,🎬 国外媒体
DOMAIN-SUFFIX,huluim.com,🎬 国外媒体
DOMAIN-SUFFIX,crunchyroll.com,🎬 国外媒体
DOMAIN-SUFFIX,bbc.com,🎬 国外媒体
DOMAIN-SUFFIX,bbc.co.uk,🎬 国外媒体
DOMAIN-SUFFIX,bbci.co.uk,🎬 国外媒体

# ─── 其他需要代理的服务 ───
DOMAIN-SUFFIX,v2ex.com,🚀 节点选择
DOMAIN-SUFFIX,medium.com,🚀 节点选择
DOMAIN-SUFFIX,reddit.com,🚀 节点选择
DOMAIN-SUFFIX,redd.it,🚀 节点选择
DOMAIN-SUFFIX,redditmedia.com,🚀 节点选择
DOMAIN-SUFFIX,imgur.com,🚀 节点选择
DOMAIN-SUFFIX,pixiv.net,🚀 节点选择
DOMAIN-SUFFIX,pximg.net,🚀 节点选择
DOMAIN-SUFFIX,nytimes.com,🚀 节点选择
DOMAIN-SUFFIX,nyt.com,🚀 节点选择
DOMAIN-SUFFIX,tumblr.com,🚀 节点选择
DOMAIN-SUFFIX,linkedin.com,🚀 节点选择
DOMAIN-SUFFIX,licdn.com,🚀 节点选择
DOMAIN-SUFFIX,mega.nz,🚀 节点选择
DOMAIN-SUFFIX,archive.org,🚀 节点选择
DOMAIN-SUFFIX,wikipedia.org,🚀 节点选择
DOMAIN-SUFFIX,wikimedia.org,🚀 节点选择
DOMAIN-SUFFIX,dropbox.com,🚀 节点选择
DOMAIN-SUFFIX,dropboxapi.com,🚀 节点选择
DOMAIN-SUFFIX,pinterest.com,🚀 节点选择
DOMAIN-SUFFIX,discord.com,🚀 节点选择
DOMAIN-SUFFIX,discord.gg,🚀 节点选择
DOMAIN-SUFFIX,discordapp.com,🚀 节点选择
DOMAIN-SUFFIX,discordapp.net,🚀 节点选择
DOMAIN-KEYWORD,blogspot,🚀 节点选择
DOMAIN-KEYWORD,dropbox,🚀 节点选择
DOMAIN-KEYWORD,wikipedia,🚀 节点选择
DOMAIN-KEYWORD,pinterest,🚀 节点选择
DOMAIN-KEYWORD,discord,🚀 节点选择

# ─── 国内直连 ───
DOMAIN-KEYWORD,baidu,DIRECT
DOMAIN-KEYWORD,alibaba,DIRECT
DOMAIN-KEYWORD,alicdn,DIRECT
DOMAIN-KEYWORD,alipay,DIRECT
DOMAIN-KEYWORD,taobao,DIRECT
DOMAIN-KEYWORD,tencent,DIRECT
DOMAIN-KEYWORD,bilibili,DIRECT
DOMAIN-KEYWORD,weibo,DIRECT
DOMAIN-KEYWORD,douyin,DIRECT
DOMAIN-KEYWORD,bytedance,DIRECT
DOMAIN-KEYWORD,xiaomi,DIRECT
DOMAIN-KEYWORD,huawei,DIRECT
DOMAIN-KEYWORD,netease,DIRECT
DOMAIN-KEYWORD,meituan,DIRECT
DOMAIN-KEYWORD,pinduoduo,DIRECT
DOMAIN-KEYWORD,kuaishou,DIRECT
DOMAIN-KEYWORD,jingdong,DIRECT
DOMAIN-SUFFIX,qq.com,DIRECT
DOMAIN-SUFFIX,weixin.com,DIRECT
DOMAIN-SUFFIX,wechat.com,DIRECT
DOMAIN-SUFFIX,gtimg.com,DIRECT
DOMAIN-SUFFIX,qcloud.com,DIRECT
DOMAIN-SUFFIX,myqcloud.com,DIRECT
DOMAIN-SUFFIX,qpic.cn,DIRECT
DOMAIN-SUFFIX,tenpay.com,DIRECT
DOMAIN-SUFFIX,tmall.com,DIRECT
DOMAIN-SUFFIX,jd.com,DIRECT
DOMAIN-SUFFIX,360buyimg.com,DIRECT
DOMAIN-SUFFIX,iqiyi.com,DIRECT
DOMAIN-SUFFIX,youku.com,DIRECT
DOMAIN-SUFFIX,ykimg.com,DIRECT
DOMAIN-SUFFIX,tudou.com,DIRECT
DOMAIN-SUFFIX,acfun.tv,DIRECT
DOMAIN-SUFFIX,hdslb.com,DIRECT
DOMAIN-SUFFIX,bilivideo.com,DIRECT
DOMAIN-SUFFIX,bilivideo.cn,DIRECT
DOMAIN-SUFFIX,biliapi.com,DIRECT
DOMAIN-SUFFIX,biliapi.net,DIRECT
DOMAIN-SUFFIX,sohu.com,DIRECT
DOMAIN-SUFFIX,sogou.com,DIRECT
DOMAIN-SUFFIX,zhihu.com,DIRECT
DOMAIN-SUFFIX,zhimg.com,DIRECT
DOMAIN-SUFFIX,douban.com,DIRECT
DOMAIN-SUFFIX,doubanio.com,DIRECT
DOMAIN-SUFFIX,163.com,DIRECT
DOMAIN-SUFFIX,126.com,DIRECT
DOMAIN-SUFFIX,126.net,DIRECT
DOMAIN-SUFFIX,127.net,DIRECT
DOMAIN-SUFFIX,yeah.net,DIRECT
DOMAIN-SUFFIX,sina.com,DIRECT
DOMAIN-SUFFIX,sinaimg.cn,DIRECT
DOMAIN-SUFFIX,ximalaya.com,DIRECT
DOMAIN-SUFFIX,xmcdn.com,DIRECT
DOMAIN-SUFFIX,csdn.net,DIRECT
DOMAIN-SUFFIX,gitee.com,DIRECT
DOMAIN-SUFFIX,jianshu.com,DIRECT
DOMAIN-SUFFIX,cnblogs.com,DIRECT
DOMAIN-SUFFIX,oschina.net,DIRECT
DOMAIN-SUFFIX,ele.me,DIRECT
DOMAIN-SUFFIX,ctrip.com,DIRECT
DOMAIN-SUFFIX,suning.com,DIRECT
DOMAIN-SUFFIX,dianping.com,DIRECT
DOMAIN-SUFFIX,amap.com,DIRECT
DOMAIN-SUFFIX,autonavi.com,DIRECT
DOMAIN-SUFFIX,mi.com,DIRECT
DOMAIN-SUFFIX,miui.com,DIRECT
DOMAIN-SUFFIX,ifeng.com,DIRECT
DOMAIN-SUFFIX,youdao.com,DIRECT
DOMAIN-SUFFIX,iciba.com,DIRECT
DOMAIN-SUFFIX,xunlei.com,DIRECT
DOMAIN-SUFFIX,smzdm.com,DIRECT
DOMAIN-SUFFIX,sspai.com,DIRECT
DOMAIN-SUFFIX,36kr.com,DIRECT
DOMAIN-SUFFIX,speedtest.net,DIRECT
DOMAIN-SUFFIX,speedtest.cn,DIRECT
DOMAIN-SUFFIX,ipip.net,DIRECT
DOMAIN-SUFFIX,ip138.com,DIRECT
DOMAIN-SUFFIX,ip.cn,DIRECT
DOMAIN-SUFFIX,cip.cc,DIRECT
DOMAIN-SUFFIX,myip.la,DIRECT
DOMAIN-SUFFIX,pconline.com.cn,DIRECT
DOMAIN-SUFFIX,test-ipv6.com,DIRECT
DOMAIN-SUFFIX,ip.sb,🚀 节点选择
DOMAIN-SUFFIX,ip-api.com,🚀 节点选择
DOMAIN-SUFFIX,ipify.org,🚀 节点选择
DOMAIN-SUFFIX,ipinfo.io,🚀 节点选择
DOMAIN-SUFFIX,cn,DIRECT
DOMAIN-KEYWORD,-cn,DIRECT

# ─── GeoIP 兜底 ───
GEOIP,CN,DIRECT

# ─── 漏网之鱼 ───
FINAL,🐟 漏网之鱼
`;

  return new Response(loonConfig, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="Loon.conf"',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
