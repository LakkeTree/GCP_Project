-- 1. 문화상품권 캐쉬 -> 플랫폼(스토어) 직접 전환/결제 수수료 테이블 생성
CREATE TABLE IF NOT EXISTS voucher_platform_conversion (
    conversion_id SERIAL PRIMARY KEY,
    source_method VARCHAR(50) NOT NULL,         -- 원래 수단
    target_platform VARCHAR(50) NOT NULL,       -- 전환/결제 대상 플랫폼
    conversion_fee_rate DECIMAL(5, 4),          -- 전환/연동 수수료율 (NULL은 불가)
    is_supported BOOLEAN NOT NULL,              -- 직접 전환/결제 지원 여부
    note TEXT                                   -- 비고 / 팩트체크
);

-- 2. 마스터 데이터 적재
INSERT INTO voucher_platform_conversion 
(source_method, target_platform, conversion_fee_rate, is_supported, note) 
VALUES
('컬쳐랜드 캐쉬', '갤럭시 스토어', 0.0000, TRUE, '컬쳐랜드 계정 직접 연동 결제 (수수료 없음)'),
('컬쳐랜드 캐쉬', '구글 플레이', 0.0300, TRUE, '구글 Play 기프트코드 바로충전 (수수료 3%)'),
('컬쳐랜드 캐쉬', '원스토어', NULL, FALSE, '원스토어 컬쳐랜드 직접 결제 수단 폐지 (불가)'),
('컬쳐랜드 캐쉬', '애플 앱스토어', NULL, FALSE, '앱스토어 컬쳐랜드 직접 결제 미지원 (불가)');