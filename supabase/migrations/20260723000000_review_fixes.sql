-- 코드 리뷰 대응: FK 삭제 전파 + 누락 인덱스 2건

-- 1. profiles는 auth.users에서 CASCADE인데, profiles를 참조하는 유저 데이터 6개 테이블은
--    기본 RESTRICT라 유저 삭제 시(auth.admin.deleteUser) 게임 데이터가 하나라도 있으면
--    트랜잭션이 FK 위반으로 실패한다 — 전부 CASCADE로 맞춘다.
alter table encounter_sessions
  drop constraint encounter_sessions_user_id_fkey,
  add constraint encounter_sessions_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;

alter table legendary_cooldowns
  drop constraint legendary_cooldowns_user_id_fkey,
  add constraint legendary_cooldowns_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;

alter table legendary_pity
  drop constraint legendary_pity_user_id_fkey,
  add constraint legendary_pity_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;

alter table user_pokedex
  drop constraint user_pokedex_user_id_fkey,
  add constraint user_pokedex_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;

alter table user_progress
  drop constraint user_progress_user_id_fkey,
  add constraint user_progress_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;

alter table user_province_unlocks
  drop constraint user_province_unlocks_user_id_fkey,
  add constraint user_province_unlocks_user_id_fkey
    foreign key (user_id) references profiles(id) on delete cascade;

-- encounter_sessions가 CASCADE라도, 그 세션을 참조하는 catch_attempts가 RESTRICT면
-- encounter_sessions 삭제 자체가 다시 막힌다(실측: 브라우저로 실제 유저 삭제 재현해 발견) —
-- 2단 참조 체인 전체가 CASCADE로 이어져야 한다.
alter table catch_attempts
  drop constraint catch_attempts_session_id_fkey,
  add constraint catch_attempts_session_id_fkey
    foreign key (session_id) references encounter_sessions(id) on delete cascade;

-- 2. fn_session_sweep은 (status, expires_at)로 조회하는데 기존 인덱스는 (user_id, status)라
--    user_id 조건이 없는 이 쿼리엔 못 쓰인다 — pending 행만 걸리는 부분 인덱스 추가.
create index idx_encounter_sessions_pending_expiry
  on encounter_sessions (expires_at)
  where status = 'pending';

-- 3. fn_bootstrap_location의 최근접 시 매칭(centroid <-> point(...))이 인덱스 없이
--    매번 cities 전체를 스캔+정렬한다 — point는 core GiST opclass를 지원하므로 바로 추가 가능.
create index idx_cities_centroid on cities using gist (centroid);
