import pandas as pd

from config import RAW_DIR, FINAL_DIR
from utils.normalize import normalize_game_name, normalize_key

# fillna(False) 시점에 발생하는 "silent downcasting" FutureWarning을
# 근본적으로 없애기 위해, pandas의 향후 동작을 미리 켜둔다.
# 이렇게 하면 fillna는 dtype을 자동 변환하지 않고,
# 아래 코드의 명시적인 .astype(bool)이 실제 변환을 담당한다.
pd.set_option("future.no_silent_downcasting", True)


PLATFORMS = [
    "google_play",
    "app_store",
    "galaxy_store",
    "one_store",
]


# id 컬럼은 숫자처럼 보여도 항상 문자열로 읽는다.
# (안 그러면 결측치와 섞일 때 pandas가 float로 승격시켜
#  "6443575749" -> "6443575749.0"처럼 깨짐)
ID_DTYPE = {
    f"{platform}_id": str
    for platform in PLATFORMS
}


def load_raw_files():
    frames = []

    for platform in PLATFORMS:
        path = RAW_DIR / f"{platform}.csv"

        if path.exists():
            df = pd.read_csv(
                path,
                encoding="utf-8-sig",
                dtype=ID_DTYPE,
            )

            if not df.empty:
                frames.append(df)

    return frames


def first_non_null(series):
    """그룹 내에서 비어있지 않은 첫 값을 반환한다 (id/url 보존용)."""
    non_null = series.dropna()
    return non_null.iloc[0] if len(non_null) > 0 else None


def create_master_database():
    print("\n[Master DB] 생성 시작")

    frames = load_raw_files()

    if not frames:
        print("[Master DB] raw CSV가 없습니다.")
        return pd.DataFrame()

    combined = pd.concat(
        frames,
        ignore_index=True,
        sort=False,
    )

    if "game_name" not in combined.columns:
        raise ValueError("game_name 컬럼이 필요합니다.")

    combined["game_name"] = combined["game_name"].apply(
        normalize_game_name
    )

    combined["game_key"] = combined["game_name"].apply(
        normalize_key
    )

    # 플랫폼 존재 여부 컬럼 (없으면 False로 채움)
    for platform in PLATFORMS:
        if platform not in combined.columns:
            combined[platform] = False

        combined[platform] = (
            combined[platform]
            .fillna(False)
            .infer_objects(copy=False)
            .astype(bool)
        )

    # 기본 집계 규칙
    aggregation = {
        "game_name": "first",
    }

    for platform in PLATFORMS:
        aggregation[platform] = "max"

    # 플랫폼별 id/url 컬럼이 raw에 존재하면 자동으로 함께 보존한다.
    # 예) google_play_id, google_play_url, app_store_id, app_store_url ...
    for platform in PLATFORMS:
        for suffix in ("_id", "_url"):
            col = f"{platform}{suffix}"
            if col in combined.columns:
                aggregation[col] = first_non_null

    # 같은 normalized key를 하나의 게임으로 합친다.
    # sort=False: 원본 수집 순서(=매출 순위 순서)를 그대로 유지
    master = (
        combined
        .groupby("game_key", as_index=False, sort=False)
        .agg(aggregation)
    )

    master.insert(
        0,
        "game_id",
        range(1, len(master) + 1),
    )

    # 최종 컬럼 순서: game_id, game_name, (platform, platform_id, platform_url) 반복
    ordered_columns = ["game_id", "game_name"]

    for platform in PLATFORMS:
        ordered_columns.append(platform)

        for suffix in ("_id", "_url"):
            col = f"{platform}{suffix}"
            if col in master.columns:
                ordered_columns.append(col)

    master = master[ordered_columns]

    output = FINAL_DIR / "games.csv"

    master.to_csv(
        output,
        index=False,
        encoding="utf-8-sig",
    )

    print(
        f"[Master DB] {len(master)}개 게임 저장: {output}"
    )

    print("\n[Master DB] 미리보기")
    print(master.head(20).to_string(index=False))

    return master