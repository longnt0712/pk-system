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
    public static final int BREAK_STREAK_DEDUCTION = 5;
    public static final long BASE_SPAWN_INTERVAL_MS = 8000L;
    private static final int[] LEVEL_TARGETS = {20, 40, 60, 90, 120, 160, 200, 250, 300, 360};
    private final long startedAt;
    private long stoppedAt;
    private long nextShotId;
    private int level = 1;
    private final Map<Integer, TeamState> teams = new LinkedHashMap<Integer, TeamState>();
    private final Map<String, PlayerProgress> players = new LinkedHashMap<String, PlayerProgress>();

    public DemonDefenseGame(long startedAt, Map<Integer, Integer> members) {
        this.startedAt = startedAt;
        for (Map.Entry<Integer, Integer> entry : members.entrySet()) {
            if (entry.getValue() > 0) {
                teams.put(entry.getKey(), new TeamState(entry.getKey(), entry.getValue(), startedAt));
            }
        }
    }

    public static int bulletsForStreak(int streak) { return Math.max(1, streak / 10); }
    public static int breakStreak(int streak) { return Math.max(0, streak - BREAK_STREAK_DEDUCTION); }
    public static int pointsRequiredForLevel(int value) {
        int index = Math.max(1, value) - 1;
        return index < LEVEL_TARGETS.length ? LEVEL_TARGETS[index]
                : (int) Math.min(Integer.MAX_VALUE, 360L + (index - 9L) * 60L);
    }
    public int minimumBulletsForPlayer(String username) {
        PlayerProgress player = players.get(username);
        return player == null ? 1 : player.bulletFloor;
    }
    public int bulletsForPlayer(String username, int streak) {
        return Math.max(minimumBulletsForPlayer(username), bulletsForStreak(streak));
    }
    public void updatePlayerStreak(String username, int streak) {
        if (username == null) { return; }
        PlayerProgress player = players.get(username);
        if (player == null) { player = new PlayerProgress(); players.put(username, player); }
        player.streak = Math.max(0, streak);
    }

    /** Roster changes affect future spawns, never existing enemies, points, or eliminated teams. */
    public void syncPlayers(Map<String, Integer> playerTeams, Map<String, Integer> streaks, long now) {
        advance(now);
        if (stoppedAt > 0L) { return; }
        Map<Integer, Integer> counts = new LinkedHashMap<Integer, Integer>();
        for (Map.Entry<String, Integer> entry : playerTeams.entrySet()) {
            Integer number = entry.getValue();
            if (number == null || number < 1) { continue; }
            Integer count = counts.get(number); counts.put(number, count == null ? 1 : count + 1);
            updatePlayerStreak(entry.getKey(), streaks.containsKey(entry.getKey()) ? streaks.get(entry.getKey()) : 0);
            players.get(entry.getKey()).teamNumber = number;
        }
        players.keySet().retainAll(playerTeams.keySet());
        for (TeamState team : teams.values()) {
            int count = counts.containsKey(team.number) ? counts.get(team.number) : 0;
            if (count != team.memberCount) {
                team.memberCount = count;
                if (count == 0 && team.eliminatedAt == 0L) { team.eliminatedAt = now; }
                if (team.eliminatedAt == 0L && count > 0) {
                    team.nextSpawnAt = now + spawnInterval(team, now);
                }
            }
        }
        for (Map.Entry<Integer, Integer> entry : counts.entrySet()) {
            if (!teams.containsKey(entry.getKey())) {
                teams.put(entry.getKey(), new TeamState(entry.getKey(), entry.getValue(), now));
            }
        }
        if (livingTeams() <= 1 && teams.size() >= 2) { stoppedAt = now; }
    }
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
                long phase = offset % WAVE_MS;
                if (team.memberCount == 0) { team.nextSpawnAt = now + BASE_SPAWN_INTERVAL_MS; break; }
                long interval = spawnInterval(team, at);
                if (phase >= 27000L) {
                    team.nextSpawnAt = startedAt + (offset / WAVE_MS + 1L) * WAVE_MS;
                    continue;
                }
                spawnBatch(team, at);
                team.nextSpawnAt = at + Math.max(360L, interval);
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

    private long spawnInterval(TeamState team, long at) {
        long interval = Math.max(360L, BASE_SPAWN_INTERVAL_MS / Math.max(1, team.memberCount));
        long phase = Math.max(0L, at - startedAt) % WAVE_MS;
        return phase >= 23000L && phase < 27000L ? Math.max(360L, interval / 2L) : interval;
    }

    /** Every batch spends exactly this level's point budget, mixing one-, two-, and three-point enemies. */
    private void spawnBatch(TeamState team, long at) {
        int remaining = level;
        long batch = ++team.spawnBatches;
        int part = 0;
        while (remaining > 0) {
            int maximum = Math.min(3, remaining);
            int points = 1 + (int) ((batch + part++) % maximum);
            long id = ++team.nextDemonId;
            boolean fast = points == 1 && id % 7L == 0L;
            long travelMs = Math.max(8500L, 26000L - (level - 1L) * 1300L);
            if (fast) { travelMs = travelMs * 2L / 3L; }
            team.demons.add(new Enemy(id, at, at + travelMs, fast, points));
            remaining -= points;
        }
    }

    private long firstCollision(TeamState team) {
        long at = Long.MAX_VALUE;
        for (Enemy enemy : team.demons) { at = Math.min(at, enemy.arrivesAt); }
        return at;
    }

    public ShotResult shoot(int number, String username, int streak, long now) {
        return shoot(number, username, streak, now, false);
    }

    public ShotResult shoot(int number, String username, int streak, long now, boolean carry) {
        advance(now);
        TeamState team = teams.get(number);
        updatePlayerStreak(username, streak);
        if (username != null) { players.get(username).teamNumber = number; }
        int bullets = bulletsForPlayer(username, streak) * (carry ? 2 : 1), hits = 0, kills = 0, points = 0;
        boolean rescued = false;
        if (team == null || team.eliminatedAt > 0L || stoppedAt > 0L) {
            return new ShotResult(0, 0, 0, 0, false);
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
                hits++;
                if (--nearest.health == 0) {
                    rescued |= progress >= DANGER_PROGRESS;
                    team.demons.remove(nearest);
                    kills++;
                    points += nearest.points;
                }
            }
        }
        team.kills += kills;
        team.points += points;
        team.levelPoints += points;
        while (team.levelPoints >= pointsRequiredForLevel(level)) {
            int overflow = team.levelPoints - pointsRequiredForLevel(level);
            level++;
            for (TeamState other : teams.values()) {
                other.levelPoints = 0;
                if (other.eliminatedAt == 0L) { other.nextSpawnAt = now + spawnInterval(other, now); }
            }
            team.levelPoints = overflow;
            for (PlayerProgress player : players.values()) {
                player.bulletFloor = Math.max(player.bulletFloor, bulletsForStreak(player.streak));
            }
        }
        if (rescued) {
            team.rescues++;
            team.rescueUsername = username;
            team.rescueAt = now;
        }
        return new ShotResult(bullets, hits, kills, points, rescued);
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
        return new Snapshot(startedAt, at, (int) (offset / WAVE_MS) + 1, level, pointsRequiredForLevel(level), phase,
                "WARNING".equals(phase) ? (int) ((23000L - phaseMs + 999L) / 1000L) : 0,
                result, stoppedAt > 0L);
    }

    private static int compareResults(TeamState a, TeamState b) {
        if ((a.eliminatedAt == 0L) != (b.eliminatedAt == 0L)) { return a.eliminatedAt == 0L ? -1 : 1; }
        if (a.eliminatedAt > 0L || b.eliminatedAt > 0L) {
            return Long.compare(b.eliminatedAt, a.eliminatedAt);
        }
        // At the time limit, compare earned points per member, including stronger demons' full value.
        return Long.compare((long) b.points * Math.max(1, a.memberCount), (long) a.points * Math.max(1, b.memberCount));
    }

    private static final class TeamState {
        final int number;
        int memberCount;
        long nextSpawnAt, nextDemonId, eliminatedAt, rescueAt, spawnBatches;
        int kills, points, levelPoints, rescues;
        String rescueUsername;
        final List<Enemy> demons = new ArrayList<Enemy>();
        final List<Shot> shots = new ArrayList<Shot>();
        TeamState(int number, int memberCount, long at) {
            this.number = number; this.memberCount = memberCount; this.nextSpawnAt = at + 3000L;
        }
    }
    private static final class PlayerProgress {
        int teamNumber, streak, bulletFloor = 1;
    }
    private static final class Enemy {
        final long id, spawnedAt, arrivesAt;
        final boolean fast, tough;
        final int points;
        int health;
        Enemy(long id, long spawnedAt, long arrivesAt, boolean fast, int points) {
            this.id = id; this.spawnedAt = spawnedAt; this.arrivesAt = arrivesAt; this.fast = fast;
            this.points = points; this.tough = points > 1; this.health = points;
        }
        double progress(long now) { return Math.max(0D, Math.min(1D, (double) (now - spawnedAt) / (arrivesAt - spawnedAt))); }
    }

    // Immutable public fields are serialized by Jackson; no question/answer/private state here.
    public static final class Snapshot {
        public final long startedAt, snapshotAt;
        public final double dangerProgress = DANGER_PROGRESS;
        public final int wave, level, levelTargetPoints, warningSeconds;
        public final String phase;
        public final List<Team> teams;
        public final boolean finished;
        Snapshot(long startedAt, long snapshotAt, int wave, int level, int levelTargetPoints, String phase, int warningSeconds, List<Team> teams, boolean finished) {
            this.startedAt = startedAt; this.snapshotAt = snapshotAt; this.wave = wave; this.phase = phase;
            this.warningSeconds = warningSeconds; this.teams = teams; this.finished = finished;
            this.level = level; this.levelTargetPoints = levelTargetPoints;
        }
    }
    public static final class Team {
        public final int number, memberCount, kills, points, levelPoints, rescues, rank;
        public final long eliminatedAt, rescueAt, survivedMs;
        public final String rescueUsername;
        public final boolean danger;
        public final double nearestDemonProgress, nearestDemonSpeed;
        public final List<Demon> demons = new ArrayList<Demon>();
        public final List<Shot> shots;
        Team(TeamState state, long at, long startedAt, int rank, boolean includeArena) {
            number = state.number; memberCount = state.memberCount; kills = state.kills; rescues = state.rescues;
            points = state.points; levelPoints = state.levelPoints;
            eliminatedAt = state.eliminatedAt; rescueAt = state.rescueAt; rescueUsername = state.rescueUsername;
            this.rank = rank;
            survivedMs = Math.max(0L, (eliminatedAt > 0L ? eliminatedAt : at) - startedAt);
            boolean inDanger = false;
            double nearestProgress = 0D, nearestSpeed = 0D;
            for (Enemy enemy : state.demons) {
                double progress = enemy.progress(at);
                double speed = 1D / (enemy.arrivesAt - enemy.spawnedAt);
                inDanger |= progress >= DANGER_PROGRESS;
                if (progress > nearestProgress || (progress == nearestProgress && speed > nearestSpeed)) {
                    nearestProgress = progress; nearestSpeed = speed;
                }
                if (includeArena) { demons.add(new Demon(enemy, at)); }
            }
            nearestDemonProgress = nearestProgress;
            nearestDemonSpeed = nearestSpeed;
            danger = inDanger && eliminatedAt == 0L;
            shots = includeArena ? new ArrayList<Shot>(state.shots) : Collections.<Shot>emptyList();
        }
    }
    public static final class Demon {
        public final long id;
        public final double progress, speed;
        public final boolean fast, tough;
        public final int health, maxHealth, points;
        Demon(Enemy enemy, long at) {
            id = enemy.id; progress = enemy.progress(at); fast = enemy.fast; tough = enemy.tough; health = enemy.health;
            maxHealth = enemy.points; points = enemy.points;
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
        public final int bullets, hits, kills, points;
        public final boolean rescued;
        ShotResult(int bullets, int hits, int kills, int points, boolean rescued) {
            this.bullets = bullets; this.hits = hits; this.kills = kills; this.rescued = rescued;
            this.points = points;
        }
    }
}
