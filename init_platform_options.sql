-- 1. 결제 옵션 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS platform_payment_options (
    option_id SERIAL PRIMARY KEY,
    payment_method VARCHAR(50) NOT NULL,
    google_play BOOLEAN NOT NULL DEFAULT FALSE,
    galaxy_store BOOLEAN NOT NULL DEFAULT FALSE,
    one_store BOOLEAN NOT NULL DEFAULT FALSE,
    app_store BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. 최종 데이터 적재
INSERT INTO platform_payment_options 
(payment_method, google_play, galaxy_store, one_store, app_store) 
VALUES
('신용/체크카드', TRUE, TRUE, TRUE, TRUE),
('통신사', TRUE, TRUE, TRUE, TRUE),
('네이버페이', TRUE, TRUE, TRUE, TRUE),
('카카오페이', TRUE, TRUE, TRUE, TRUE),
('은행계좌(kcp)', TRUE, TRUE, TRUE, FALSE),
('Toss 페이', TRUE, TRUE, TRUE, TRUE),
('PAYCO', TRUE, TRUE, TRUE, TRUE),
('자체기프트카드', TRUE, TRUE, TRUE, TRUE),
('삼성페이', FALSE, TRUE, TRUE, FALSE),
('컬쳐랜드결제', FALSE, TRUE, FALSE, FALSE),
('퀵계좌이체', FALSE, TRUE, TRUE, FALSE),
('애플페이', FALSE, FALSE, FALSE, TRUE),
('스토어전용멤버십적립', TRUE, TRUE, TRUE, FALSE),
('통신사 할인', FALSE, FALSE, TRUE, FALSE);
