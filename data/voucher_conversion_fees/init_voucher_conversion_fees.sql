-- 1. 문화상품권 캐쉬 제휴사 전환 수수료 테이블 생성
CREATE TABLE IF NOT EXISTS voucher_conversion_fees (
    conversion_id SERIAL PRIMARY KEY,
    source_method VARCHAR(50) NOT NULL,         -- 원래 수단
    target_partner VARCHAR(50) NOT NULL,        -- 전환 제휴사
    conversion_fee_rate DECIMAL(5, 4) NOT NULL, -- 전환 수수료율 (소수점)
    note TEXT                                   -- 비고 / 팩트체크 포인트
);

-- 2. 마스터 데이터 적재
INSERT INTO voucher_conversion_fees 
(source_method, target_partner, conversion_fee_rate, note) 
VALUES
('컬쳐랜드 캐쉬', '네이버페이 포인트', 0.0600, '컬쳐랜드에서 네이버페이 포인트로 전환 시 수수료 6% 차감'),
('컬쳐랜드 캐쉬', 'PAYCO 포인트', 0.0800, '컬쳐랜드에서 PAYCO 포인트로 전환 시 수수료 8% 차감'),
('컬쳐랜드 캐쉬', '스마일캐시', 0.0300, '컬쳐랜드에서 스마일캐시로 전환 시 수수료 3% 차감'),
('컬쳐랜드 캐쉬', 'SSG MONEY', 0.0500, '컬쳐랜드에서 SSG MONEY로 전환 시 수수료 5% 차감');