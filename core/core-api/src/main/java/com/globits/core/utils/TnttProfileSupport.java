package com.globits.core.utils;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

import com.globits.core.domain.Person;
import com.globits.core.dto.PersonDto;

/** The same rules apply to new profiles and all user update endpoints. */
public final class TnttProfileSupport {
    private static final Set<String> MEMBER_TYPES = new HashSet<String>(Arrays.asList(
            "DOAN_SINH", "DU_TRUONG", "HUYNH_TRUONG", "TRO_TA", "TRO_UY", "TUYEN_UY"));
    private static final Set<String> BRANCHES = new HashSet<String>(Arrays.asList(
            "CHIEN_CON", "AU_NHI", "THIEU_NHI", "NGHIA_SI", "HIEP_SI"));

    private TnttProfileSupport() { }

    public static class InvalidProfileException extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        public InvalidProfileException(String message) { super(message); }
    }

    public static void apply(PersonDto dto, Person person) {
        // Older clients may edit names/photos without knowing these fields.
        if (!dto.isTnttMemberTypeSpecified() && !dto.isTnttBranchSpecified()
                && !dto.isTnttLevelSpecified()) return;

        String type = dto.isTnttMemberTypeSpecified()
                ? normalize(dto.getTnttMemberType()) : person.getTnttMemberType();
        String branch = dto.isTnttBranchSpecified()
                ? normalize(dto.getTnttBranch()) : person.getTnttBranch();
        Integer level = dto.isTnttLevelSpecified() ? dto.getTnttLevel() : person.getTnttLevel();

        if (type != null && !MEMBER_TYPES.contains(type))
            throw new InvalidProfileException("Thành phần TNTT không hợp lệ.");
        if (branch != null && !BRANCHES.contains(branch))
            throw new InvalidProfileException("Ngành TNTT không hợp lệ.");

        boolean student = "DOAN_SINH".equals(type);
        boolean leader = "HUYNH_TRUONG".equals(type);
        if (!student) {
            if (dto.isTnttBranchSpecified() && branch != null)
                throw new InvalidProfileException("Ngành sinh hoạt chỉ áp dụng cho đoàn sinh.");
            branch = null;
        }
        // A rank belongs to a member type and, for students, to a branch.
        if (!dto.isTnttLevelSpecified() && (!Objects.equals(type, person.getTnttMemberType())
                || !Objects.equals(branch, person.getTnttBranch()))) level = null;
        if (!student && !leader) {
            if (dto.isTnttLevelSpecified() && level != null)
                throw new InvalidProfileException("Cấp TNTT chỉ áp dụng cho đoàn sinh hoặc Huynh trưởng.");
            level = null;
        }
        if (level != null) {
            if (level < 1 || level > (leader ? 4 : 3))
                throw new InvalidProfileException("Đoàn sinh có cấp I–III; Huynh trưởng có cấp I–III hoặc Đặc cấp.");
            if (student && branch == null)
                throw new InvalidProfileException("Vui lòng chọn ngành trước khi chọn cấp đoàn sinh.");
        }
        person.setTnttMemberType(type);
        person.setTnttBranch(branch);
        person.setTnttLevel(level);
    }

    private static String normalize(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim().toUpperCase(Locale.ROOT);
    }
}
