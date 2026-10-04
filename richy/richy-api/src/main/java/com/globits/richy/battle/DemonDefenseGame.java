package com.globits.richy.battle;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Server-authoritative simulation. Call under the containing room's lock. */
public final class DemonDefenseGame {
    public static final long WAVE_MS = 30000L;
    public static final double DANGER_PROGRESS = 0.75D;
    private final long startedAt;
    private long stoppedAt;
    private long nextShotId;
    private final Map<Integer, TeamState> teams = new LinkedHashMap<Integer, TeamState>();

    public DemonDefenseGame(long startedAt, Map<Integer, Integer> members) {
        this.startedAt = startedAt;
        for (Map.Entry<Integer, Integer> entry : members.entrySet()) {
            if (entry.getValue() > 0) {
                teams.put(entry.getKey(), new TeamState(entry.getKey(), entry.getValue(), startedAt));
            }
        }
    }

    public static int bulletsForStreak(int streak) { return Math.max(1, streak / 10); }
    public static int breakStreak(int streak) { return Math.max(0, streak - 10); }
    public boolean containsTeam(int number) { return teams.containsKey(number); }
    public boolean isEliminated(int number) {
        TeamState team = teams.get(number);
        return team == null || team.eliminatedAt > 0L;
    }

    /** Absolute timestamps make deaths independent of timer/network frequency. */
    public void advance(long now) {
        if (stoppedAt > 0L) { return; }
        for (TeamState team : teams.values()) {
            if (team.eliminatedAt > 0L) { continue; }
            while (team.nextSpawnAt <= now) {
                long at = team.nextSpawnAt;
                if (firstCollision(team) <= at) { break; }
                long offset = Math.max(0L, at - startedAt);
                int wave = (int) (offset / WAVE_MS) + 1;
                long phase = offset % WAVE_MS;
                // Same schedule/fast-demon proportion for all teams; density scales with roster.
                long interval = Math.max(900L, 6500L - (wave - 1) * 450L) / team.memberCount;
                if (phase >= 23000L && phase < 27000L) { interval = Math.max(180L, interval / 2L); }
                if (phase >= 27000L) {
                    team.nextSpawnAt = startedAt + (offset / WAVE_MS + 1L) * WAVE_MS;
                    continue;
                }
                boolean fast = (++team.nextDemonId % 7L) == 0L;
                long travelMs = Math.max(8500L, 26000L - (wave - 1) * 1300L);
                if (fast) { travelMs = travelMs * 2L / 3L; }
                team.demons.add(new Enemy(team.nextDemonId, at, at + travelMs, fast));
                team.nextSpawnAt = at + Math.max(180L, interval);
                if (phase < 23000L) {
                    team.nextSpawnAt = Math.min(team.nextSpawnAt,
                            startedAt + (offset / WAVE_MS) * WAVE_MS + 23000L);
                }
                // A delayed tick must not create enemies after this team's first collision.
                long collision = firstCollision(team);
                if (team.nextSpawnAt > collision && collision <= now) { break; }
            }
            long collision = firstCollision(team);
            if (collision <= now) { team.eliminatedAt = collision; }
            while (!team.shots.isEmpty() && team.shots.get(0).at < now - 2500L) {
                team.shots.remove(0);
            }
        }
        // Settle every collision in this tick before declaring a winner (simultaneous losses tie).
        if (livingTeams() <= 1 && teams.size() >= 2) { stoppedAt = now; }
    }

    private long firstCollision(TeamState team) {
        long at = Long.MAX_VALUE;
        for (Enemy enemy : team.demons) { at = Math.min(at, enemy.arrivesAt); }
        return at;
    }

    public ShotResult shoot(int number, String username, int streak, long now) {
        advance(now);
        TeamState team = teams.get(number);
        int bullets = bulletsForStreak(streak), kills = 0;
        boolean rescued = false;
        if (team == null || team.eliminatedAt > 0L || stoppedAt > 0L) {
            return new ShotResult(0, 0, false);
        }
        for (int index = 0; index < bullets; index++) {
            Enemy nearest = null;
            for (Enemy enemy : team.demons) {
                if (nearest == null || enemy.progress(now) > nearest.progress(now) ||
                        (enemy.progress(now) == nearest.progress(now) && enemy.id < nearest.id)) {
                    nearest = enemy;
                }
            }
            double progress = nearest == null ? 0D : nearest.progress(now);
            team.shots.add(new Shot(++nextShotId, username, progress, now, nearest != null));
            if (nearest != null) {
                rescued |= progress >= DANGER_PROGRESS;
                team.demons.remove(nearest);
                kills++;
            }
        }
        team.kills += kills;
        if (rescued) {
            team.rescues++;
            team.rescueUsername = username;
            team.rescueAt = now;
        }
        return new ShotResult(bullets, kills, rescued);
    }

    public int livingTeams() {
        int count = 0;
        for (TeamState team : teams.values()) { if (team.eliminatedAt == 0L) { count++; } }
        return count;
    }
    public boolean isFinished() { return stoppedAt > 0L; }
    public void stop(long now) { advance(now); if (stoppedAt == 0L) { stoppedAt = now; } }

    public Snapshot snapshot(long now, boolean includeArena) {
        final long at = stoppedAt > 0L ? stoppedAt : now;
        List<TeamState> ranked = new ArrayList<TeamState>(teams.values());
        Collections.sort(ranked, new Comparator<TeamState>() {
            public int compare(TeamState a, TeamState b) { return compareResults(a, b); }
        });
        List<Team> result = new ArrayList<Team>();
        int rank = 0;
        TeamState previous = null;
        for (int index = 0; index < ranked.size(); index++) {
            TeamState team = ranked.get(index);
            if (previous == null || compareResults(previous, team) != 0) { rank = index + 1; }
            result.add(new Team(team, at, startedAt, rank, includeArena));
            previous = team;
        }
        long offset = Math.max(0L, at - startedAt), phaseMs = offset % WAVE_MS;
        String phase = phaseMs >= 27000L ? "REST" : phaseMs >= 23000L ? "HORDE" :
                phaseMs >= 20000L ? "WARNING" : "NORMAL";
        return new Snapshot(startedAt, at, (int) (offset / WAVE_MS) + 1, phase,
                "WARNING".equals(phase) ? (int) ((23000L - phaseMs + 999L) / 1000L) : 0,
                result, stoppedAt > 0L);
    }

    private static int compareResults(TeamState a, TeamState b) {
        if ((a.eliminatedAt == 0L) != (b.eliminatedAt == 0L)) { return a.eliminatedAt == 0L ? -1 : 1; }
        if (a.eliminatedAt > 0L || b.eliminatedAt > 0L) {
            return Long.compare(b.eliminatedAt, a.eliminatedAt);
        }
        // At the time limit, normalized kills distinguish surviving teams of different sizes.
        return Long.compare((long) b.kills * a.memberCount, (long) a.kills * b.memberCount);
    }

    private static final class TeamState {
        final int number, memberCount;
        long nextSpawnAt, nextDemonId, eliminatedAt, rescueAt;
        int kills, rescues;
        String rescueUsername;
        final List<Enemy> demons = new ArrayList<Enemy>();
        final List<Shot> shots = new ArrayList<Shot>();
        TeamState(int number, int memberCount, long at) {
            this.number = number; this.memberCount = memberCount; this.nextSpawnAt = at + 3000L;
        }
    }
    private static final class Enemy {
        final long id, spawnedAt, arrivesAt;
        final boolean fast;
        Enemy(long id, long spawnedAt, long arrivesAt, boolean fast) {
            this.id = id; this.spawnedAt = spawnedAt; this.arrivesAt = arrivesAt; this.fast = fast;
        }
        double progress(long now) { return Math.max(0D, Math.min(1D, (double) (now - spawnedAt) / (arrivesAt - spawnedAt))); }
    }

    // Immutable public fields are serialized by Jackson; no question/answer/private state here.
    public static final class Snapshot {
        public final long startedAt, snapshotAt;
        public final int wave, warningSeconds;
        public final String phase;
        public final List<Team> teams;
        public final boolean finished;
        Snapshot(long startedAt, long snapshotAt, int wave, String phase, int warningSeconds, List<Team> teams, boolean finished) {
            this.startedAt = startedAt; this.snapshotAt = snapshotAt; this.wave = wave; this.phase = phase;
            this.warningSeconds = warningSeconds; this.teams = teams; this.finished = finished;
        }
    }
    public static final class Team {
        public final int number, memberCount, kills, rescues, rank;
        public final long eliminatedAt, rescueAt, survivedMs;
        public final String rescueUsername;
        public final boolean danger;
        public final List<Demon> demons = new ArrayList<Demon>();
        public final List<Shot> shots;
        Team(TeamState state, long at, long startedAt, int rank, boolean includeArena) {
            number = state.number; memberCount = state.memberCount; kills = state.kills; rescues = state.rescues;
            eliminatedAt = state.eliminatedAt; rescueAt = state.rescueAt; rescueUsername = state.rescueUsername;
            this.rank = rank;
            survivedMs = Math.max(0L, (eliminatedAt > 0L ? eliminatedAt : at) - startedAt);
            boolean inDanger = false;
            for (Enemy enemy : state.demons) {
                inDanger |= enemy.progress(at) >= DANGER_PROGRESS;
                if (includeArena) { demons.add(new Demon(enemy, at)); }
            }
            danger = inDanger && eliminatedAt == 0L;
            shots = includeArena ? new ArrayList<Shot>(state.shots) : Collections.<Shot>emptyList();
        }
    }
    public static final class Demon {
        public final long id;
        public final double progress, speed;
        public final boolean fast;
        Demon(Enemy enemy, long at) {
            id = enemy.id; progress = enemy.progress(at); fast = enemy.fast;
            speed = 1D / (enemy.arrivesAt - enemy.spawnedAt);
        }
    }
    public static final class Shot {
        public final long id, at;
        public final String username;
        public final double progress;
        public final boolean hit;
        Shot(long id, String username, double progress, long at, boolean hit) {
            this.id = id; this.username = username; this.progress = progress; this.at = at; this.hit = hit;
        }
    }
    public static final class ShotResult {
        public final int bullets, kills;
        public final boolean rescued;
        ShotResult(int bullets, int kills, boolean rescued) { this.bullets = bullets; this.kills = kills; this.rescued = rescued; }
    }
}
