# fbok

## Proje özeti

**fbok**, Facebook ana akışındaki `Sponsored / Sponsorlu` reklam gönderilerini tespit etmeyi ve kullanıcı tercihine göre gizlemeyi amaçlayan, Chrome ve Brave için Manifest V3 tabanlı açık kaynak bir browser extension projesidir.

## Problem

Facebook feed'inde sponsored postlar normal gönderilere çok benzer biçimde render edildiği ve işaretleme yapısı zaman zaman değiştiği için, yalnızca basit metin veya CSS seçicilerine dayanan çözümler kolayca kırılabilir.

## Neden Facebook'a özel?

Bu proje generic bir ad blocker değildir. Ağ isteklerini veya genel reklam URL listelerini engellemek yerine, Facebook'un DOM yapısını analiz eden **Facebook'a özel, DOM-level bir blocker** olarak tasarlanır.

## Teknik yaklaşım

- Manifest V3
- Facebook sayfalarında çalışan content script
- Dinamik/infinite feed değişikliklerini izlemek için `MutationObserver`
- Birbirinden bağımsız birden fazla sponsored-post detection yöntemi
- `aria-label` / `aria-labelledby` accessibility detection
- Facebook reklam metadata'sındaki `/ads/about` linkini yüksek güvenli sinyal olarak kullanma; linki global tarayıp en yakın feed container'ına çözümleme
- Chromium'daki SVG `<use href="#…">` sprite referanslarını çözme
- Görünür veya obfuscate edilmiş `Sponsored / Sponsorlu` metnini CSS sırasına göre yeniden oluşturma
- Feed header'ındaki kapalı shadow DOM içinde render edilen `Ad` etiketi için, onu saran `/ads/about/` linkini doğrudan tespit etme
- Görünür kısa `Ad` etiketi için postun üst metadata bölgesi + yakın advertiser/link bağlamı fallback'i
- Güncel `aria-posinset` feed container'ları + `FeedUnit`/semantic article fallback'leri
- **Fail-open:** yeterli güven yoksa gönderiyi gizlememe

## v0.1

Mevcut sürüm güvenli bir debug/highlight mode kullanır; hiçbir postu gizlemez.

- Sponsored adayını outline ile işaretler
- Detection reason gösterir
- Debug modunda sayfanın sol altında `scanned / hits` sayacı gösterir
- İncelenen postları ayrıca işaretleyerek scan/detection ayrımını görünür kılar
- İngilizce `Sponsored`, Türkçe `Sponsorlu` ve güncel kısa `Ad` etiketlerini tanır
- Infinite scroll / dinamik DOM değişikliklerini izler
- GitHub Actions ile manifest ve JavaScript syntax doğrulaması yapar

Manuel doğrulama adımları için [`docs/manual-test.md`](docs/manual-test.md) dosyasına bak.

### Yerel kurulum

1. Repoyu clone/download et.
2. Chrome'da `chrome://extensions`, Brave'de `brave://extensions` sayfasını aç.
3. **Developer mode**'u etkinleştir.
4. **Load unpacked** ile repo klasörünü seç.
5. Facebook'u aç veya yenile.

### Validation

```bash
npm test
```

Harici runtime dependency yoktur.

## Daha sonraki hedefler

- Gerçek hide mode
- Extension on/off switch
- Blocked counter
- Türkçe + İngilizce arayüz/detection desteği
- Sidebar ads desteği
- Opsiyonel `Suggested for you` filtreleme

## Privacy

- Zero telemetry
- Zero external requests
- Yalnızca `facebook.com` için host erişimi
- Kullanıcı verisi toplama veya uzak sunucuya gönderme yok

## Yayınlama

Hedef, extension'ı yeterli false-positive testinden sonra **Chrome Web Store** üzerinde yayınlamaktır.
