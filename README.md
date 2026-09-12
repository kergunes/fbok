# fbok

## Proje özeti

**fbok**, Facebook ana akışındaki `Sponsored / Sponsorlu / Ad` reklam gönderilerini tespit etmeyi ve kullanıcı tercihine göre gizlemeyi amaçlayan, Chrome ve Brave için Manifest V3 tabanlı açık kaynak bir browser extension projesidir.

## Problem

Facebook feed'inde reklam postları normal gönderilere çok benzer biçimde render edilir. Üstelik reklam etiketi kalıcı plain text olmak zorunda değildir: accessibility portal node'u kısa süre yaşayıp silinebilir, SVG sprite üzerinden çizilebilir veya harfleri CSS `order` ile yeniden sıralanmış/decoy span'lerle karıştırılmış olabilir.

## Neden Facebook'a özel?

Bu proje generic bir ad blocker değildir. Ağ isteklerini veya genel reklam URL listelerini engellemek yerine Facebook'un DOM ve accessibility davranışını analiz eden **Facebook'a özel, DOM-level bir blocker** olarak tasarlanır.

## Teknik yaklaşım

- Manifest V3 + Facebook-only content script
- `MutationObserver` + animation-frame batching
- `aria-label` / `aria-labelledby` detection
- kısa ömürlü accessibility label'larını id → text cache ile kurtarma
- sonradan gelen text node'larını ve removal record'larını yakalama
- cached label oluştuğunda reverse-referrer resolution
- SVG `<use href="#…">` sprite target resolution
- CSS `order` ile görsel sıralama + üç farklı decoy partition reconstruction
- yalnızca **pozitif olarak Sponsored/Ad sınıflandırılmış** ama henüz posta bağlanamamış sinyaller için bounded retry queue
- `aria-posinset`, `FeedUnit`, semantic article ve geometry fallback ile post resolution
- unlabeled-ad shape heuristics yalnızca zaten inspect edilen feed postunda bir kez çalışır; document-wide shape sweep yoktur
- **fail-open:** hide mode açılana kadar şüpheli postlar yalnızca highlight edilir

## v0.1

v0.1.9 detection lifecycle'ı güncel Facebook-specific blocker davranışlarına göre yeniden düzenler.

Debug görünümü:
- yüksek güven: kırmızı solid outline
- orta güven shape candidate: turuncu dashed outline
- post üzerinde detection reason
- sol altta scan/cache/late-label/retry sayaçları

Manuel doğrulama için [`docs/manual-test.md`](docs/manual-test.md).

### Yerel kurulum

1. Repoyu clone/download et.
2. Chrome'da `chrome://extensions`, Brave'de `brave://extensions`.
3. **Developer mode** aç.
4. **Load unpacked** ile repo klasörünü seç.
5. Facebook'u hard refresh et.

### Validation

```bash
npm test
```

Harici runtime dependency yoktur.

## Daha sonraki hedefler

- gerçek hide/collapse mode
- debug/hide switch
- extension on/off switch
- blocked counter
- local settings persistence
- Türkçe + İngilizce UI
- sidebar ads
- optional “Suggested for you” filtering
- Chrome Web Store yayınlama

## Privacy

- zero telemetry
- zero external requests
- yalnızca `facebook.com` host erişimi
- kullanıcı verisi toplama veya uzak sunucuya gönderme yok
