-- 문화상품권 캐쉬 충전 마스터 테이블
CREATE TABLE IF NOT EXISTS voucher_cash_rates (
    voucher_id SERIAL PRIMARY KEY,
    voucher_name VARCHAR(50) NOT NULL,          -- 원래 수단 (상품권 종류)
    target_cash_name VARCHAR(50) NOT NULL,      -- 충전 대상 (컬쳐캐쉬 등)
    purchase_discount_rate DECIMAL(5, 4),       -- 공식 제휴처 할인율 (0.0300 = 3%)
    charge_fee_rate DECIMAL(5, 4),              -- 충전 수수료율 (0.0000 = 0%)
    net_benefit_rate DECIMAL(5, 4),             -- 실질 혜택률 (0.0300 = 3%)
    supported_platforms VARCHAR(100),           -- 지원 가능 플랫폼
    note TEXT
);

INSERT INTO voucher_cash_rates 
(voucher_name, target_cash_name, purchase_discount_rate, charge_fee_rate, net_benefit_rate, supported_platforms, note) 
VALUES
('컬쳐랜드 문화상품권', '컬쳐랜드 캐쉬', 0.0300, 0.0000, 0.0300, '갤럭시스토어 등', '문화상품권 핀번호 1:1 충전 (3% 할인 온전히 적용)'),
('도서문화상품권 (북앤라이프)', '북앤라이프 캐시', 0.0300, 0.0000, 0.0300, '지원 스토어', '북앤라이프 공식 핀번호 1:1 충전 (3% 할인 온전히 적용)');