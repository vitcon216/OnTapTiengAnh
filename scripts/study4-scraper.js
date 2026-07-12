/*
Hướng dẫn:
1. Đăng nhập vào Study4 và mở trang danh sách từ vựng (VD: https://study4.com/courses/28/complete-toeic/learn/units/186/)
2. Ấn F12 để mở Developer Tools, chọn tab Console.
3. Copy toàn bộ đoạn code dưới đây và dán vào Console, sau đó ấn Enter.
4. Một file 'words.json' sẽ được tải xuống tự động. 
5. Bạn có thể sử dụng file đó bằng cách import vào ứng dụng ở phần Cài đặt.
*/

(function scrapeStudy4() {
    let result = [];
    // Lưu ý: Các selector dưới đây là giả định do không thể truy cập trực tiếp Study4.
    // Nếu layout Study4 khác, bạn cần sửa lại document.querySelectorAll() cho khớp class name.
    
    // Giả định mỗi từ vựng nằm trong thẻ div có class '.word-item' (hãy inspect để xem class thật)
    let wordElements = document.querySelectorAll('.word-box'); // VD class tên .word-box
    
    if (wordElements.length === 0) {
        console.error("Không tìm thấy từ vựng nào. Có thể cần cuộn trang xuống hoặc chọn sai class CSS.");
        // Gợi ý cho người dùng nếu sai class
        wordElements = document.querySelectorAll('.vocab-item'); // Thử class khác
    }

    wordElements.forEach((el, index) => {
        try {
            // Thay đổi các selector này tuỳ theo DOM của Study4
            const word = el.querySelector('.word-text')?.innerText || '';
            const ipa = el.querySelector('.ipa-text')?.innerText || '';
            const type = el.querySelector('.word-type')?.innerText || '';
            const meaning = el.querySelector('.word-meaning')?.innerText || '';
            const example = el.querySelector('.example-en')?.innerText || '';
            const translation = el.querySelector('.example-vi')?.innerText || '';

            if (word) {
                result.push({
                    id: "w_" + index + "_" + Date.now(),
                    word: word.trim(),
                    ipa: ipa.trim(),
                    type: type.trim().replace(/[\(\)]/g, ''),
                    meaning: meaning.trim(),
                    example: example.trim(),
                    translation: translation.trim(),
                    topic: "Study4 Unit"
                });
            }
        } catch (e) {
            console.warn("Lỗi khi parse 1 từ vựng:", e);
        }
    });

    if (result.length > 0) {
        console.log(`Đã trích xuất thành công ${result.length} từ vựng! Đang tải xuống...`);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "words.json");
        dlAnchorElem.click();
    } else {
        console.error("Không thể lấy được từ vựng. Bạn hãy kiểm tra lại Element Inspector để cập nhật class name trong script này nhé!");
    }
})();
