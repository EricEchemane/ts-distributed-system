migrate:
	cd databases/drizzle &&\
	npx drizzle-kit migrate &&\
	cd ../../

generate:
	cd databases/drizzle &&\
	npx drizzle-kit generate &&\
	cd ../../

dockerup:
	docker compose up -d

dockerdown:
	docker compose down