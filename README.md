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
- SVG ve accessibility/ARIA label detection
- Görünür veya obfuscate edilmiş `Sponsored / Sponsorlu` metnini DOM parçalarından yeniden oluşturma
- Tespit edilen işaretten doğru feed post container'ına yükselme
- **Fail-open:** yeterli güven yoksa gönderiyi gizlememe

## v0.1 hedefi

İlk sürüm doğrudan reklam silmeyecek. Önce güvenli bir debug/highlight mode geliştirilecek:

- Şüpheli reklam gönderilerini highlight etme
- Her tespitte detected reason gösterme
- Farklı Facebook DOM varyasyonlarında false-positive testi
- Detection yöntemlerini ayrı ayrı gözlemleyebilme

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
- Yalnızca `facebook.com` için host permission
- Kullanıcı verisi toplama veya uzak sunucuya gönderme yok

## Yayınlama

Hedef, extension'ı yeterli false-positive testinden sonra **Chrome Web Store** üzerinde yayınlamaktır.
