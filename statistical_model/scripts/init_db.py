from app.db.indexes import ensure_indexes
from app.db.mongo import get_db


def main() -> None:
    ensure_indexes(get_db())
    print("MongoDB indexes ensured")


if __name__ == "__main__":
    main()

