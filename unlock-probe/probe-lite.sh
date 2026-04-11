set +e
family="${1:-4}"
if [ "$family" = "6" ]; then CURL_IP="-6"; else CURL_IP="-4"; fi
echo MARKER_BEGIN
ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
json_escape(){ python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip(), ensure_ascii=False)[1:-1])' 2>/dev/null || sed 's/"/\\"/g'; }
line(){ key="$1"; name="$2"; status="$3"; statusText="$4"; region="$5"; type="$6"; typeText="$7"; detail="$8"; printf '{"key":"%s","name":"%s","status":"%s","statusText":"%s","region":"%s","type":"%s","typeText":"%s","detail":"%s"}\n' "$key" "$(printf '%s' "$name" | json_escape)" "$status" "$(printf '%s' "$statusText" | json_escape)" "$(printf '%s' "$region" | json_escape)" "$type" "$(printf '%s' "$typeText" | json_escape)" "$(printf '%s' "$detail" | json_escape)"; }
ok(){ line "$1" "$2" ok 解锁 "$3" "$4" "$5" "$6"; }
partial(){ line "$1" "$2" partial 部分 "$3" "$4" "$5" "$6"; }
fail(){ line "$1" "$2" fail 屏蔽 "$3" "$4" "$5" "$6"; }
err(){ line "$1" "$2" error 失败 "$3" "$4" "$5" "$6"; }
pending(){ line "$1" "$2" pending 待支持 "$3" "$4" "$5" "$6"; }
# DNS/type helpers inspired by IPQuality
is_private_ip(){ ip="$1"; case "$ip" in ""|127.*|10.*|192.168.*|169.254.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2[0-9].*|172.3[0-1].*|fe8*|FE8*|fc*|FC*|fd*|FD*|::1) return 0;; *) return 1;; esac; }
check_dns_1(){ host="$1"; if [ "$family" = "6" ]; then ans=$(dig +short AAAA "$host" 2>/dev/null | head -1); else ans=$(dig +short A "$host" 2>/dev/null | head -1); fi; is_private_ip "$ans" && echo 0 || echo 1; }
check_dns_2(){ host="$1"; if [ "$family" = "6" ]; then ans=$(dig +short AAAA "test$RANDOM$RANDOM.$host" 2>/dev/null | head -1); else ans=$(dig +short A "test$RANDOM$RANDOM.$host" 2>/dev/null | head -1); fi; [ -n "$ans" ] && echo 0 || echo 1; }
unlock_type(){ bad=0; total=0; for v in "$@"; do total=$((total+1)); [ "$v" = "0" ] && bad=$((bad+1)); done; [ "$bad" -ge 1 ] && [ "$total" -gt 0 ] && { echo 'dns|DNS'; return; }; echo 'native|原生'; }
trace=$(curl $CURL_IP -s --max-time 10 https://chatgpt.com/cdn-cgi/trace 2>&1)
trace_ip=$(printf '%s' "$trace" | awk -F= '/^ip=/{print $2}')
trace_loc=$(printf '%s' "$trace" | awk -F= '/^loc=/{print $2}')
if [ -z "$trace_ip" ]; then err trace 出口信息 '' unknown 未知 "IPv${family} 不可用或 trace 失败"; trace_loc=""; else line trace 出口信息 ok 正常 "$trace_loc" native 原生 "$trace_ip"; fi
if [ "$family" = "6" ] && [ -z "$trace_ip" ]; then
  for k in netflix youtube spotify chatgpt claude gemini; do pending "$k" "$k" '' unknown 未知 'IPv6 不可用，未执行检测'; done
  pending disney 'Disney+' '' pending 待接入 'IPv6 待接入'
  pending tiktok TikTok '' pending 待支持 'TikTok IPv6 暂不支持'
  echo MARKER_END; exit 0
fi
# Netflix - region parse + full/org/no
ut=$(unlock_type "$(check_dns_1 netflix.com)" "$(check_dns_2 netflix.com)" "$(check_dns_2 netflix.com)"); utype=${ut%|*}; utext=${ut#*|}
nf1=$(curl $CURL_IP -A "$ua" -fsL --max-time 10 --tlsv1.3 https://www.netflix.com/title/81280792 2>&1)
nf2=$(curl $CURL_IP -A "$ua" -fsL --max-time 10 --tlsv1.3 https://www.netflix.com/title/70143836 2>&1)
if echo "$nf1$nf2" | grep -qi '^curl'; then err netflix Netflix "$trace_loc" unknown 未知 网络连接失败
else
  region=$(printf '%s' "$nf1" | sed -n 's/.*"requestCountry"[^}]*"id":"\([A-Z][A-Z]\)".*/\1/p' | head -1)
  [ -z "$region" ] && region=$(printf '%s' "$nf1" | sed -n 's/.*"id":"\([A-Z][A-Z]\)".*"countryName".*/\1/p' | head -1)
  [ -z "$region" ] && region=$(printf '%s' "$nf2" | sed -n 's/.*"id":"\([A-Z][A-Z]\)".*"countryName".*/\1/p' | head -1)
  [ -z "$region" ] && region="$trace_loc"
  oh1=$(printf '%s' "$nf1" | grep 'Oh no!'); oh2=$(printf '%s' "$nf2" | grep 'Oh no!')
  if echo "$nf1$nf2" | grep -q 'og:video'; then ok netflix Netflix "$region" "$utype" "$utext" 完整解锁
  elif [ -n "$oh1" ] && [ -n "$oh2" ]; then partial netflix Netflix "$region" org 仅自制 仅自制剧或受限
  else fail netflix Netflix "$region" "$utype" "$utext" 未检测到可播放标记
  fi
fi
# Disney+ - v4 full, v6 pending first
if [ "$family" = "6" ]; then
  pending disney 'Disney+' "$trace_loc" pending 待接入 'IPv6 待接入'
else
  ut=$(unlock_type "$(check_dns_1 disneyplus.com)" "$(check_dns_2 disneyplus.com)"); utype=${ut%|*}; utext=${ut#*|}
  PreAssertion=$(curl $CURL_IP -A "$ua" -s --max-time 12 -X POST "https://disney.api.edge.bamgrid.com/devices" -H "authorization: Bearer ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84" -H "content-type: application/json; charset=UTF-8" -d '{"deviceFamily":"browser","applicationRuntime":"chrome","deviceProfile":"windows","attributes":{}}' 2>&1)
  assertion=$(echo "$PreAssertion" | python3 -c 'import sys,json; 
try: print(json.load(sys.stdin).get("assertion", ""))
except Exception: print("")' 2>/dev/null)
  if [ -z "$assertion" ]; then err disney Disney+ "$trace_loc" unknown 未知 获取设备 assertion 失败
  else
    disneycookie="grant_type=urn:ietf:params:oauth:grant-type:token-exchange&latitude=0&longitude=0&platform=browser&subject_token=$assertion&subject_token_type=urn:bamtech:params:oauth:token-type:device"
    TokenContent=$(curl $CURL_IP -A "$ua" -s --max-time 12 -X POST "https://disney.api.edge.bamgrid.com/token" -H "authorization: Bearer ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84" -d "$disneycookie" 2>&1)
    if echo "$TokenContent" | grep -qE 'forbidden-location|403 ERROR'; then fail disney Disney+ "$trace_loc" idc 机房 'forbidden-location 或 403'
    else
      refreshToken=$(echo "$TokenContent" | python3 -c 'import sys,json; 
try: print(json.load(sys.stdin).get("refresh_token", ""))
except Exception: print("")' 2>/dev/null)
      if [ -z "$refreshToken" ]; then partial disney Disney+ "$trace_loc" unknown 未知 未取得 refresh_token
      else
        disneycontent='{"query":"mutation refreshToken($input: RefreshTokenInput!) { refreshToken(refreshToken: $input) { activeSession { sessionId } } }","variables":{"input":{"refreshToken":"'"$refreshToken"'"}}}'
        tmpresult=$(curl $CURL_IP -A "$ua" -sSL --max-time 12 "https://disney.api.edge.bamgrid.com/graph/v1/device/graphql" -H "authorization: Bearer ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84" -H "content-type: application/json" -d "$disneycontent" 2>&1)
        preview=$(curl $CURL_IP -s -o /dev/null -L --max-time 10 -w '%{url_effective}' https://disneyplus.com 2>&1)
        region=$(echo "$tmpresult" | grep -o '"countryCode":"[A-Z][A-Z]"' | head -1 | cut -d '"' -f4); [ -z "$region" ] && region="$trace_loc"
        if echo "$tmpresult" | grep -q 'inSupportedLocation.*true'; then ok disney Disney+ "$region" "$utype" "$utext" 支持地区
        elif echo "$tmpresult" | grep -q 'inSupportedLocation.*false' && ! echo "$preview" | grep -q 'unavailable'; then pending disney Disney+ "$region" pending 待支持 地区有返回但暂未支持
        elif echo "$preview" | grep -q 'unavailable'; then fail disney Disney+ "$region" idc 机房 当前地区不可用
        else partial disney Disney+ "$region" unknown 未知 API 返回不完整，需确认
        fi
      fi
    fi
  fi
fi
# YouTube Premium - IPQuality style
ut=$(unlock_type "$(check_dns_1 www.youtube.com)" "$(check_dns_2 www.youtube.com)"); utype=${ut%|*}; utext=${ut#*|}
yt=$(curl $CURL_IP -A "$ua" -sSL --max-time 12 -H 'Accept-Language: en' -b 'CONSENT=YES+cb.20220301-11-p0.en+FX+700; PREF=tz=Asia.Shanghai' https://www.youtube.com/premium 2>&1)
if echo "$yt" | grep -qi '^curl'; then err youtube 'YouTube Premium' "$trace_loc" unknown 未知 网络连接失败
elif echo "$yt" | grep -q 'www.google.cn'; then fail youtube 'YouTube Premium' CN cn 中国 跳转到 Google 中国，Premium 不可用
elif echo "$yt" | grep -q 'Premium is not available in your country'; then fail youtube 'YouTube Premium' "$trace_loc" noprem 禁会员 Premium 不支持当前地区
else
  region=$(printf '%s' "$yt" | sed -n 's/.*"contentRegion":"\([A-Z][A-Z]\)".*/\1/p' | head -1); [ -z "$region" ] && region=$(printf '%s' "$yt" | grep -o '"countryCode"[^,}]*' | head -1 | cut -d '"' -f4); [ -z "$region" ] && region="$trace_loc"
  if echo "$yt" | grep -qiE 'ad-free|purchaseButtonOverride|Start trial|countryCode|contentRegion'; then ok youtube 'YouTube Premium' "$region" "$utype" "$utext" 'Premium 可用或地区可用'; else err youtube 'YouTube Premium' "$region" unknown 未知 '页面未识别 Premium 标记'; fi
fi
# Spotify
sp=$(curl $CURL_IP -A "$ua" -sSL --max-time 12 https://www.spotify.com/signup 2>&1)
if echo "$sp" | grep -qi '^curl'; then err spotify Spotify "$trace_loc" unknown 未知 网络连接失败
else sp_region=$(printf '%s' "$sp" | grep -o '"country"[[:space:]]*:[[:space:]]*"[A-Z][A-Z]"' | head -1 | cut -d '"' -f4); [ -z "$sp_region" ] && sp_region="$trace_loc"; if echo "$sp" | grep -qiE 'signup|country|Spotify'; then ok spotify Spotify "$sp_region" native 原生 注册页可访问; else partial spotify Spotify "$sp_region" unknown 未知 页面可访问但未识别注册标记; fi; fi
# TikTok - two pass + IDC distinction
ut=$(unlock_type "$(check_dns_1 tiktok.com)" "$(check_dns_2 tiktok.com)"); utype=${ut%|*}; utext=${ut#*|}
if [ "$family" = "6" ]; then pending tiktok TikTok "$trace_loc" pending 待支持 'TikTok IPv6 暂不支持'; else
  tk1=$(curl $CURL_IP -A "$ua" -sL --max-time 12 https://www.tiktok.com/ 2>&1)
  tk_region=$(printf '%s' "$tk1" | grep '"region":' | sed 's/.*"region"//' | cut -f2 -d'"' | head -1)
  if [ -n "$tk_region" ]; then ok tiktok TikTok "$(printf '%s' "$tk_region"|tr '[:lower:]' '[:upper:]')" "$utype" "$utext" 访问正常
  else
    tk2=$(curl $CURL_IP -A "$ua" -sL --max-time 12 -H 'Accept-Encoding: gzip' -H 'Accept-Language: en' https://www.tiktok.com/explore 2>/dev/null | gunzip 2>/dev/null)
    tk_region2=$(printf '%s' "$tk2" | grep '"region":' | sed 's/.*"region"//' | cut -f2 -d'"' | head -1)
    if [ -n "$tk_region2" ]; then partial tiktok TikTok "$(printf '%s' "$tk_region2"|tr '[:lower:]' '[:upper:]')" idc 机房 '二次请求可用，疑似机房/限制环境'
    elif echo "$tk1" | grep -qi '^curl'; then err tiktok TikTok "$trace_loc" unknown 未知 网络连接失败
    else fail tiktok TikTok "$trace_loc" idc 机房 '未检测到 TikTok 地区标记，可能不可用'
    fi
  fi
fi
# ChatGPT - web/app distinction from IPQuality
ut=$(unlock_type "$(check_dns_1 chat.openai.com)" "$(check_dns_2 chat.openai.com)" "$(check_dns_2 chat.openai.com)" "$(check_dns_1 ios.chat.openai.com)" "$(check_dns_2 api.openai.com)"); utype=${ut%|*}; utext=${ut#*|}
api_req=$(curl $CURL_IP -A "$ua" -sS --max-time 12 'https://api.openai.com/compliance/cookie_requirements' -H 'authorization: Bearer null' -H 'origin: https://platform.openai.com' -H 'referer: https://platform.openai.com/' 2>&1)
ios_req=$(curl $CURL_IP -A "$ua" -sS --max-time 12 https://ios.chat.openai.com/ 2>&1)
favicon_code=$(curl $CURL_IP -A "$ua" -o /dev/null -sS --max-time 12 -w '%{http_code}' https://chatgpt.com/favicon.ico 2>&1)
api_block=$(echo "$api_req" | grep 'unsupported_country'); ios_vpn=$(echo "$ios_req" | grep -i 'VPN\|blocked_why_headline\|unsupported_country_region_territory')
if [ -z "$api_block" ] && [ -z "$ios_vpn" ] && ! echo "$api_req$ios_req" | grep -qi '^curl'; then ok chatgpt ChatGPT "$trace_loc" "$utype" "$utext" '网页和 APP 均可用'
elif [ -z "$api_block" ] && [ -n "$ios_vpn" ]; then partial chatgpt ChatGPT "$trace_loc" web 仅网页 '网页可用，APP 可能受限'
elif [ -n "$api_block" ] && [ -z "$ios_vpn" ]; then partial chatgpt ChatGPT "$trace_loc" app 仅APP 'APP 可用，网页/API 可能受限'
elif [ "$favicon_code" != "403" ] && [ -n "$api_block" ]; then partial chatgpt ChatGPT "$trace_loc" web 仅网页 '网页资源可访问，API/平台受限'
else fail chatgpt ChatGPT "$trace_loc" idc 机房 '网页和 APP 均受限或检测失败'; fi
# Claude
cl=$(curl $CURL_IP -A "$ua" -s -o /dev/null -L --max-time 12 -w '%{url_effective} %{http_code}' https://claude.ai/ 2>&1)
if echo "$cl" | grep -qE 'unavailable|000| 403'; then partial claude Claude "$trace_loc" web 仅网页 '访问返回 403/不可用，需进一步确认'; else ok claude Claude "$trace_loc" native 原生 可用; fi
# Gemini
gem=$(curl $CURL_IP -A "$ua" -sSL --max-time 12 'https://gemini.google.com/_/BardChatUi/data/batchexecute' -H 'accept-language: en-US' --data-raw 'f.req=[[['"'"'K4WWud'"'"',"[[0],[\"en-US\"]]",null,"generic"]]]' 2>&1)
if echo "$gem" | grep -qi '^curl'; then err gemini Gemini "$trace_loc" unknown 未知 网络连接失败; elif echo "$gem" | grep -q 'K4WWud'; then partial gemini Gemini "$trace_loc" native 原生 '位置接口有返回，需进一步确认'; else fail gemini Gemini "$trace_loc" unknown 未知 未返回位置接口标记; fi
echo MARKER_END
