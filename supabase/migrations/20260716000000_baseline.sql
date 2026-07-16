SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE OR REPLACE FUNCTION "public"."calc_catch_rate"("bst" smallint) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select greatest(0.10, least(0.90,
    0.90 - (least(greatest(bst, 200), 720) - 200)::numeric / (720 - 200) * 0.80
  ));
$$;

ALTER FUNCTION "public"."calc_catch_rate"("bst" smallint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."calc_legendary_catch_rate"("fail_visits" smallint) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select least(1.0, 0.03 + fail_visits * 0.01);
$$;

ALTER FUNCTION "public"."calc_legendary_catch_rate"("fail_visits" smallint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."calc_spawn_rate"("bst" smallint) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select greatest(0.05, least(0.30,
    0.30 - (least(greatest(bst, 200), 720) - 200)::numeric / (720 - 200) * 0.25
  ));
$$;

ALTER FUNCTION "public"."calc_spawn_rate"("bst" smallint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."calc_user_tier"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select case
    when pct >= 0.90 then '마스터볼'
    when pct >= 0.60 then '하이퍼볼'
    when pct >= 0.30 then '슈퍼볼'
    else '몬스터볼'
  end
  from (
    select count(*)::numeric / (select count(*) from pokemon_species) as pct
    from user_pokedex where user_id = p_user_id
  ) t;
$$;

ALTER FUNCTION "public"."calc_user_tier"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."check_endgame_unlock"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select not exists (
    select 1
    from provinces pr
    join v_user_province_progress vp
      on vp.province_id = pr.id and vp.user_id = p_user_id
    where pr.is_island_endgame = false
      and vp.pct < 1.0
  );
$$;

ALTER FUNCTION "public"."check_endgame_unlock"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."check_province_unlock"("p_user_id" "uuid", "p_province_id" smallint) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    (select pct >= 0.70 from v_user_province_progress
     where user_id = p_user_id and province_id = p_province_id),
    false
  );
$$;

ALTER FUNCTION "public"."check_province_unlock"("p_user_id" "uuid", "p_province_id" smallint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_pokedex_upsert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_session encounter_sessions%rowtype;
begin
  if new.success then
    select * into v_session from encounter_sessions where id = new.session_id;

    insert into user_pokedex (user_id, dex_no, first_caught_city_id)
    values (v_session.user_id, v_session.dex_no, v_session.city_id)
    on conflict (user_id, dex_no) do update set catch_count = user_pokedex.catch_count + 1;

    update encounter_sessions set status = 'caught' where id = new.session_id;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."fn_pokedex_upsert"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_progress_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."fn_progress_touch"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fn_session_flee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_session encounter_sessions%rowtype;
  v_fail_count int;
  v_province_id smallint;
begin
  if new.success then
    return new;
  end if;

  select * into v_session from encounter_sessions where id = new.session_id;

  select count(*) into v_fail_count
  from catch_attempts
  where session_id = new.session_id and success = false;

  if v_fail_count < 3 then
    return new;
  end if;

  update encounter_sessions set status = 'fled' where id = new.session_id;

  if v_session.is_legendary then
    select la.province_id into v_province_id
    from cities ci join living_areas la on la.id = ci.living_area_id
    where ci.id = v_session.city_id;

    insert into legendary_pity (user_id, province_id, fail_visits)
    values (v_session.user_id, v_province_id, 1)
    on conflict (user_id, province_id) do update set fail_visits = legendary_pity.fail_visits + 1;

    insert into legendary_cooldowns (user_id, province_id, next_available_at)
    values (v_session.user_id, v_province_id, now() + interval '1 hour')
    on conflict (user_id, province_id) do update set next_available_at = now() + interval '1 hour';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."fn_session_flee"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."catch_attempts" (
    "id" bigint NOT NULL,
    "session_id" "uuid" NOT NULL,
    "attempt_no" smallint NOT NULL,
    "catch_rate_used" numeric(5,4) NOT NULL,
    "success" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catch_attempts_attempt_no_check" CHECK (("attempt_no" = ANY (ARRAY[1, 2, 3])))
);

ALTER TABLE "public"."catch_attempts" OWNER TO "postgres";

ALTER TABLE "public"."catch_attempts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."catch_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" integer NOT NULL,
    "living_area_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "centroid" "point" NOT NULL,
    "is_legendary_site" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."cities" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."city_connections" (
    "city_a_id" integer NOT NULL,
    "city_b_id" integer NOT NULL,
    CONSTRAINT "city_connections_check" CHECK (("city_a_id" < "city_b_id"))
);

ALTER TABLE "public"."city_connections" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."encounter_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "city_id" integer NOT NULL,
    "dex_no" smallint NOT NULL,
    "is_legendary" boolean DEFAULT false NOT NULL,
    "spawn_rate_used" numeric(5,4),
    "attempts_used" smallint DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:02:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "encounter_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'caught'::"text", 'fled'::"text"])))
);

ALTER TABLE "public"."encounter_sessions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."legendary_cooldowns" (
    "user_id" "uuid" NOT NULL,
    "province_id" smallint NOT NULL,
    "next_available_at" timestamp with time zone NOT NULL
);

ALTER TABLE "public"."legendary_cooldowns" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."legendary_pity" (
    "user_id" "uuid" NOT NULL,
    "province_id" smallint NOT NULL,
    "fail_visits" smallint DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."legendary_pity" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."living_areas" (
    "id" integer NOT NULL,
    "province_id" smallint NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "region_id_override" smallint,
    "is_endgame_area" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."living_areas" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pokemon_regions" (
    "id" smallint NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."pokemon_regions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pokemon_species" (
    "dex_no" smallint NOT NULL,
    "name_en" "text" NOT NULL,
    "name_kr" "text" NOT NULL,
    "type1" "text" NOT NULL,
    "type2" "text",
    "bst" smallint NOT NULL,
    "flavor_text" "text"
);

ALTER TABLE "public"."pokemon_species" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."provinces" (
    "id" smallint NOT NULL,
    "name" "text" NOT NULL,
    "region_id" smallint NOT NULL,
    "legendary_dex_no" smallint,
    "is_island_endgame" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."provinces" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."region_spawn_pool" (
    "id" bigint NOT NULL,
    "living_area_id" integer NOT NULL,
    "dex_no" smallint NOT NULL,
    "category" "text" NOT NULL,
    "is_legendary" boolean DEFAULT false NOT NULL,
    CONSTRAINT "region_spawn_pool_category_check" CHECK (("category" = ANY (ARRAY['공통'::"text", '고유'::"text"])))
);

ALTER TABLE "public"."region_spawn_pool" OWNER TO "postgres";

ALTER TABLE "public"."region_spawn_pool" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."region_spawn_pool_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."user_pokedex" (
    "user_id" "uuid" NOT NULL,
    "dex_no" smallint NOT NULL,
    "first_caught_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_caught_city_id" integer NOT NULL,
    "catch_count" integer DEFAULT 1 NOT NULL
);

ALTER TABLE "public"."user_pokedex" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_progress" (
    "user_id" "uuid" NOT NULL,
    "current_city_id" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_progress" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_province_unlocks" (
    "user_id" "uuid" NOT NULL,
    "province_id" smallint NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_province_unlocks" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_city_neighbors" AS
 SELECT "city_connections"."city_a_id" AS "city_id",
    "city_connections"."city_b_id" AS "neighbor_id"
   FROM "public"."city_connections"
UNION ALL
 SELECT "city_connections"."city_b_id" AS "city_id",
    "city_connections"."city_a_id" AS "neighbor_id"
   FROM "public"."city_connections";

ALTER VIEW "public"."v_city_neighbors" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_user_province_progress" AS
 SELECT "p"."id" AS "user_id",
    "pr"."id" AS "province_id",
    "count"(DISTINCT "rsp"."dex_no") AS "total_count",
    "count"(DISTINCT "up"."dex_no") AS "caught_count",
        CASE
            WHEN ("count"(DISTINCT "rsp"."dex_no") = 0) THEN (0)::numeric
            ELSE (("count"(DISTINCT "up"."dex_no"))::numeric / ("count"(DISTINCT "rsp"."dex_no"))::numeric)
        END AS "pct"
   FROM (((("public"."profiles" "p"
     CROSS JOIN "public"."provinces" "pr")
     JOIN "public"."living_areas" "la" ON (("la"."province_id" = "pr"."id")))
     JOIN "public"."region_spawn_pool" "rsp" ON ((("rsp"."living_area_id" = "la"."id") AND ("rsp"."is_legendary" = false))))
     LEFT JOIN "public"."user_pokedex" "up" ON ((("up"."user_id" = "p"."id") AND ("up"."dex_no" = "rsp"."dex_no"))))
  GROUP BY "p"."id", "pr"."id";

ALTER VIEW "public"."v_user_province_progress" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_user_tier" AS
 SELECT "id" AS "user_id",
    "public"."calc_user_tier"("id") AS "tier"
   FROM "public"."profiles";

ALTER VIEW "public"."v_user_tier" OWNER TO "postgres";

ALTER TABLE ONLY "public"."catch_attempts"
    ADD CONSTRAINT "catch_attempts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."catch_attempts"
    ADD CONSTRAINT "catch_attempts_session_id_attempt_no_key" UNIQUE ("session_id", "attempt_no");

ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."city_connections"
    ADD CONSTRAINT "city_connections_pkey" PRIMARY KEY ("city_a_id", "city_b_id");

ALTER TABLE ONLY "public"."encounter_sessions"
    ADD CONSTRAINT "encounter_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."legendary_cooldowns"
    ADD CONSTRAINT "legendary_cooldowns_pkey" PRIMARY KEY ("user_id", "province_id");

ALTER TABLE ONLY "public"."legendary_pity"
    ADD CONSTRAINT "legendary_pity_pkey" PRIMARY KEY ("user_id", "province_id");

ALTER TABLE ONLY "public"."living_areas"
    ADD CONSTRAINT "living_areas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."living_areas"
    ADD CONSTRAINT "living_areas_province_id_name_key" UNIQUE ("province_id", "name");

ALTER TABLE ONLY "public"."pokemon_regions"
    ADD CONSTRAINT "pokemon_regions_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."pokemon_regions"
    ADD CONSTRAINT "pokemon_regions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pokemon_species"
    ADD CONSTRAINT "pokemon_species_name_en_key" UNIQUE ("name_en");

ALTER TABLE ONLY "public"."pokemon_species"
    ADD CONSTRAINT "pokemon_species_pkey" PRIMARY KEY ("dex_no");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_nickname_key" UNIQUE ("nickname");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."region_spawn_pool"
    ADD CONSTRAINT "region_spawn_pool_living_area_id_dex_no_key" UNIQUE ("living_area_id", "dex_no");

ALTER TABLE ONLY "public"."region_spawn_pool"
    ADD CONSTRAINT "region_spawn_pool_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_pokedex"
    ADD CONSTRAINT "user_pokedex_pkey" PRIMARY KEY ("user_id", "dex_no");

ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."user_province_unlocks"
    ADD CONSTRAINT "user_province_unlocks_pkey" PRIMARY KEY ("user_id", "province_id");

CREATE INDEX "idx_cities_living_area" ON "public"."cities" USING "btree" ("living_area_id");

CREATE INDEX "idx_encounter_user_status" ON "public"."encounter_sessions" USING "btree" ("user_id", "status");

CREATE INDEX "idx_provinces_region" ON "public"."provinces" USING "btree" ("region_id");

CREATE OR REPLACE TRIGGER "trg_pokedex_upsert" AFTER INSERT ON "public"."catch_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_pokedex_upsert"();

CREATE OR REPLACE TRIGGER "trg_progress_touch" BEFORE UPDATE ON "public"."user_progress" FOR EACH ROW EXECUTE FUNCTION "public"."fn_progress_touch"();

CREATE OR REPLACE TRIGGER "trg_session_flee" AFTER INSERT ON "public"."catch_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."fn_session_flee"();

ALTER TABLE ONLY "public"."catch_attempts"
    ADD CONSTRAINT "catch_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."encounter_sessions"("id");

ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_living_area_id_fkey" FOREIGN KEY ("living_area_id") REFERENCES "public"."living_areas"("id");

ALTER TABLE ONLY "public"."city_connections"
    ADD CONSTRAINT "city_connections_city_a_id_fkey" FOREIGN KEY ("city_a_id") REFERENCES "public"."cities"("id");

ALTER TABLE ONLY "public"."city_connections"
    ADD CONSTRAINT "city_connections_city_b_id_fkey" FOREIGN KEY ("city_b_id") REFERENCES "public"."cities"("id");

ALTER TABLE ONLY "public"."encounter_sessions"
    ADD CONSTRAINT "encounter_sessions_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");

ALTER TABLE ONLY "public"."encounter_sessions"
    ADD CONSTRAINT "encounter_sessions_dex_no_fkey" FOREIGN KEY ("dex_no") REFERENCES "public"."pokemon_species"("dex_no");

ALTER TABLE ONLY "public"."encounter_sessions"
    ADD CONSTRAINT "encounter_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."legendary_cooldowns"
    ADD CONSTRAINT "legendary_cooldowns_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id");

ALTER TABLE ONLY "public"."legendary_cooldowns"
    ADD CONSTRAINT "legendary_cooldowns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."legendary_pity"
    ADD CONSTRAINT "legendary_pity_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id");

ALTER TABLE ONLY "public"."legendary_pity"
    ADD CONSTRAINT "legendary_pity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."living_areas"
    ADD CONSTRAINT "living_areas_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id");

ALTER TABLE ONLY "public"."living_areas"
    ADD CONSTRAINT "living_areas_region_id_override_fkey" FOREIGN KEY ("region_id_override") REFERENCES "public"."pokemon_regions"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_legendary_dex_no_fkey" FOREIGN KEY ("legendary_dex_no") REFERENCES "public"."pokemon_species"("dex_no");

ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."pokemon_regions"("id");

ALTER TABLE ONLY "public"."region_spawn_pool"
    ADD CONSTRAINT "region_spawn_pool_dex_no_fkey" FOREIGN KEY ("dex_no") REFERENCES "public"."pokemon_species"("dex_no");

ALTER TABLE ONLY "public"."region_spawn_pool"
    ADD CONSTRAINT "region_spawn_pool_living_area_id_fkey" FOREIGN KEY ("living_area_id") REFERENCES "public"."living_areas"("id");

ALTER TABLE ONLY "public"."user_pokedex"
    ADD CONSTRAINT "user_pokedex_dex_no_fkey" FOREIGN KEY ("dex_no") REFERENCES "public"."pokemon_species"("dex_no");

ALTER TABLE ONLY "public"."user_pokedex"
    ADD CONSTRAINT "user_pokedex_first_caught_city_id_fkey" FOREIGN KEY ("first_caught_city_id") REFERENCES "public"."cities"("id");

ALTER TABLE ONLY "public"."user_pokedex"
    ADD CONSTRAINT "user_pokedex_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_current_city_id_fkey" FOREIGN KEY ("current_city_id") REFERENCES "public"."cities"("id");

ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."user_province_unlocks"
    ADD CONSTRAINT "user_province_unlocks_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id");

ALTER TABLE ONLY "public"."user_province_unlocks"
    ADD CONSTRAINT "user_province_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."catch_attempts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."city_connections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."encounter_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

ALTER TABLE "public"."legendary_cooldowns" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."legendary_pity" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."living_areas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_direct_write" ON "public"."catch_attempts" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_write" ON "public"."encounter_sessions" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_write" ON "public"."legendary_cooldowns" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_write" ON "public"."legendary_pity" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_write" ON "public"."user_pokedex" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_write" ON "public"."user_progress" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_write" ON "public"."user_province_unlocks" USING (false) WITH CHECK (false);

ALTER TABLE "public"."pokemon_regions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pokemon_species" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provinces" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."region_spawn_pool" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all" ON "public"."cities" FOR SELECT USING (true);

CREATE POLICY "select_all" ON "public"."city_connections" FOR SELECT USING (true);

CREATE POLICY "select_all" ON "public"."living_areas" FOR SELECT USING (true);

CREATE POLICY "select_all" ON "public"."pokemon_regions" FOR SELECT USING (true);

CREATE POLICY "select_all" ON "public"."pokemon_species" FOR SELECT USING (true);

CREATE POLICY "select_all" ON "public"."provinces" FOR SELECT USING (true);

CREATE POLICY "select_all" ON "public"."region_spawn_pool" FOR SELECT USING (true);

CREATE POLICY "select_own" ON "public"."catch_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."encounter_sessions" "es"
  WHERE (("es"."id" = "catch_attempts"."session_id") AND ("es"."user_id" = "auth"."uid"())))));

CREATE POLICY "select_own" ON "public"."encounter_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "select_own" ON "public"."legendary_cooldowns" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "select_own" ON "public"."legendary_pity" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "select_own" ON "public"."user_pokedex" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "select_own" ON "public"."user_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "select_own" ON "public"."user_province_unlocks" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));

ALTER TABLE "public"."user_pokedex" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_progress" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_province_unlocks" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."calc_catch_rate"("bst" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."calc_catch_rate"("bst" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_catch_rate"("bst" smallint) TO "service_role";

GRANT ALL ON FUNCTION "public"."calc_legendary_catch_rate"("fail_visits" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."calc_legendary_catch_rate"("fail_visits" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_legendary_catch_rate"("fail_visits" smallint) TO "service_role";

GRANT ALL ON FUNCTION "public"."calc_spawn_rate"("bst" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."calc_spawn_rate"("bst" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_spawn_rate"("bst" smallint) TO "service_role";

GRANT ALL ON FUNCTION "public"."calc_user_tier"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calc_user_tier"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_user_tier"("p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."check_endgame_unlock"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_endgame_unlock"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_endgame_unlock"("p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."check_province_unlock"("p_user_id" "uuid", "p_province_id" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."check_province_unlock"("p_user_id" "uuid", "p_province_id" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_province_unlock"("p_user_id" "uuid", "p_province_id" smallint) TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_pokedex_upsert"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_pokedex_upsert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_pokedex_upsert"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_progress_touch"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_progress_touch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_progress_touch"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_session_flee"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_session_flee"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_session_flee"() TO "service_role";

GRANT ALL ON TABLE "public"."catch_attempts" TO "anon";
GRANT ALL ON TABLE "public"."catch_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."catch_attempts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."catch_attempts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."catch_attempts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."catch_attempts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";

GRANT ALL ON TABLE "public"."city_connections" TO "anon";
GRANT ALL ON TABLE "public"."city_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."city_connections" TO "service_role";

GRANT ALL ON TABLE "public"."encounter_sessions" TO "anon";
GRANT ALL ON TABLE "public"."encounter_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_sessions" TO "service_role";

GRANT ALL ON TABLE "public"."legendary_cooldowns" TO "anon";
GRANT ALL ON TABLE "public"."legendary_cooldowns" TO "authenticated";
GRANT ALL ON TABLE "public"."legendary_cooldowns" TO "service_role";

GRANT ALL ON TABLE "public"."legendary_pity" TO "anon";
GRANT ALL ON TABLE "public"."legendary_pity" TO "authenticated";
GRANT ALL ON TABLE "public"."legendary_pity" TO "service_role";

GRANT ALL ON TABLE "public"."living_areas" TO "anon";
GRANT ALL ON TABLE "public"."living_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."living_areas" TO "service_role";

GRANT ALL ON TABLE "public"."pokemon_regions" TO "anon";
GRANT ALL ON TABLE "public"."pokemon_regions" TO "authenticated";
GRANT ALL ON TABLE "public"."pokemon_regions" TO "service_role";

GRANT ALL ON TABLE "public"."pokemon_species" TO "anon";
GRANT ALL ON TABLE "public"."pokemon_species" TO "authenticated";
GRANT ALL ON TABLE "public"."pokemon_species" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."provinces" TO "anon";
GRANT ALL ON TABLE "public"."provinces" TO "authenticated";
GRANT ALL ON TABLE "public"."provinces" TO "service_role";

GRANT ALL ON TABLE "public"."region_spawn_pool" TO "anon";
GRANT ALL ON TABLE "public"."region_spawn_pool" TO "authenticated";
GRANT ALL ON TABLE "public"."region_spawn_pool" TO "service_role";

GRANT ALL ON SEQUENCE "public"."region_spawn_pool_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."region_spawn_pool_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."region_spawn_pool_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."user_pokedex" TO "anon";
GRANT ALL ON TABLE "public"."user_pokedex" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pokedex" TO "service_role";

GRANT ALL ON TABLE "public"."user_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_progress" TO "service_role";

GRANT ALL ON TABLE "public"."user_province_unlocks" TO "anon";
GRANT ALL ON TABLE "public"."user_province_unlocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_province_unlocks" TO "service_role";

GRANT ALL ON TABLE "public"."v_city_neighbors" TO "anon";
GRANT ALL ON TABLE "public"."v_city_neighbors" TO "authenticated";
GRANT ALL ON TABLE "public"."v_city_neighbors" TO "service_role";

GRANT ALL ON TABLE "public"."v_user_province_progress" TO "anon";
GRANT ALL ON TABLE "public"."v_user_province_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."v_user_province_progress" TO "service_role";

GRANT ALL ON TABLE "public"."v_user_tier" TO "anon";
GRANT ALL ON TABLE "public"."v_user_tier" TO "authenticated";
GRANT ALL ON TABLE "public"."v_user_tier" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
