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
- medium shape adayları artık kullanıcı kararıyla kalıcı olarak gizlenir; her gizlenen kart debug reveal düğmesiyle geri getirilebilir

## v0.1

v0.1.9 detection lifecycle'ı güncel Facebook-specific blocker davranışlarına göre yeniden düzenler.

v0.5.1 davranışı:
- high-confidence reklam eşleşmeleri CSS ile gizlenir
- medium-confidence shape candidate'lar kalıcı olarak CSS ile gizlenir ve debug reveal akışında denetlenebilir
- üst metadata bandında render edilen Sponsored/Sponsorlu tokenları ek high-confidence sinyalidir
- kısa "Ad" tokenı tek başına yeterli değildir; outbound-link + no-permalink shape ile corroborate edilirse high'a yükseltilir
- `Ad` artık plain text, ARIA, title ve SVG sprite yollarında da aynı bağımsız outbound-link + no-permalink koşulunu gerektirir
- MutationObserver aynı ekleme dalı için mutation target'ı ikinci kez taramaz; frame queue tek tarama planlar
- mixed header wrapper içindeki doğrudan text node'ları da sınırlı görsel metadata bandında taranır
- Facebook React feed-unit metadata içindeki `category: SPONSORED` değeri birincil high-confidence sinyalidir
- React metadata bulunamazsa text/ARIA/geometry yolları yalnızca muhafazakâr fallback olarak çalışır; CTA tek başına blocking sinyali değildir
- React metadata taraması yalnızca resolved card ve sınırlı feed-unit adaylarıyla bounded tutulur
- React metadata bulunamazsa ilgili kart fail-open kalır; bu yol henüz obfuscated category hash çözümlemesi yapmaz
- React/content hydration gecikmelerinde yalnızca inspected card başına üç bounded retry yapılır; characterData gözlemi ve document-wide sweep açılmaz
- `blocked` yalnızca her DOM card için bir kez artar ve `currentlyHidden` reveal sonrasında gerçek gizli kart sayısını gösterir
- `__fbokDebug.blockedPosts()` gizlenen kartların confidence, reason, kısa metin ve ilk 16 link bilgisini on-demand döndürür
- page-world Console erişimi için yalnızca `blockedPosts`/`diagnostics` read-only DOM-event bridge'i bulunur
- blocked-post raporu karar anında snapshot alınarak Facebook re-render'ından sonra da korunur; `stillConnected` ve `hiddenNow` yaşam döngüsü durumunu gösterir
- debug modunda gizlenen kartları feed'i değiştirmeden geri göstermek için her bağlı blocked card için `Reveal blocked #N` düğmesi gösterilir; düğme kartı görünür yapıp bulunduğu konuma kaydırır; reveal işlemi `blocked` sayacını veya snapshot'ı silmez
- popup'taki `hideSuggested` ayarı açıkken üst metadata bölgesindeki `Suggested for you`/`Senin için önerilen` etiketi, `Follow`/`Takip et` kontrolü veya grup `Join`/`Katıl` kontrolü suggested post olarak high-confidence gizlenebilir; bu sinyaller reklam sayılmaz ve ayrı `suggested-*` reason'ları ile raporlanır
- Facebook sağ sütunundaki `Sponsored` modülü Contacts alanına dokunmadan gizlenir
- araç çubuğundaki fbok popup'ından suggested-post filtresi açılıp kapatılabilir; seçim `chrome.storage.sync` ile korunur
- nested Facebook mutations için label taramaları animation-frame başına coalesced edilir; aynı batch içindeki iç içe scan root'ları ikinci kez taranmaz
- queued scan root deduplication enqueue aşamasında yapılır; büyük mutation batch'lerinde all-pairs containment taraması yoktur
- sol altta scan/cache/late-label/retry sayaçları kalır

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
