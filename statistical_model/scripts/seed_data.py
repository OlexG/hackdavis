from app.db.mongo import get_db
from app.db.seed import seed_database


def main() -> None:
    seed_database(get_db())
    print("Seed data loaded")


if __name__ == "__main__":
    main()

