package com.globits.security.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

@Repository
public interface UserRepository
        extends JpaRepository<User, Long> {

    @Query("select new User(u.id, u.username, u.email, u.accountNonLocked) "
            + "from User u where u.username like ?1")
    Page<User> searchByPageBasicInfo(
            Pageable pageable,
            String userName
    );

    @Query("select new User(u.id, u.username, u.email, u.accountNonLocked) "
            + "from User u")
    Page<User> findByPageBasicInfo(Pageable pageable);

    @Query("select u from User u "
            + "left join fetch u.roles "
            + "where u.username = ?1")
    User findByUsername(String username);

    @Query("select u from User u "
            + "left join fetch u.roles "
            + "left join fetch u.person "
            + "where u.username = ?1")
    User findByUsernameAndPerson(String username);

    @Query("select u from User u where u.email = :email")
    User findByEmail(@Param("email") String email);

    @Query("select u from User u "
            + "left join fetch u.roles "
            + "where u.id = ?1")
    User findById(Long id);

    @Query("select new com.globits.security.dto.UserDto(u) "
            + "from User u "
            + "where u.username like %?1%")
    Page<UserDto> findByPageUsername(
            String username,
            Pageable pageable
    );

    @Query("select new com.globits.security.dto.UserDto(u, true) "
            + "from User u "
            + "where u.active = true")
    List<UserDto> getAllUserWithDisplayNameAndUsername();

	@Query("select distinct new com.globits.security.dto.UserDto(u, true) "
			+ "from User u join u.roles r "
			+ "where u.active = true and r.name in :roleNames")
	List<UserDto> getActiveUsersByRoleNames(@Param("roleNames") List<String> roleNames);

    @Query("select new com.globits.security.dto.UserDto(u, true) "
            + "from User u "
            + "where u.active = true "
            + "and u.person.displayName like %?1%")
    List<UserDto> getAllUserWithDisplayNameAndUsername(
            String grade
    );

    @Query("select distinct u from User u left join u.enrollmentClassIds ec "
            + "where (u.person.enrollmentClassId = ?1 or cast(ec as integer) = ?1) "
            + "and u.active = true")
    List<User> getUsersByEnrollmentClass(
            int enrollmentClass
    );

    /*
     * Chỉ lọc theo lớp.
     */
    @Query(
        "select new com.globits.security.dto.UserDto(u) "
        + "from User u left join u.enrollmentClassIds ec "
        + "where (u.person.enrollmentClassId = :enrollmentClassId or cast(ec as integer) = :enrollmentClassId) "
        + "and u.active = true"
    )
    List<UserDto> getUsersDtoByEnrollmentClass(
            @Param("enrollmentClassId")
            int enrollmentClassId
    );

	@Query("select distinct u from User u left join u.enrollmentClassIds ec "
			+ "where (cast(u.person.enrollmentClassId as long) in :ids or ec in :ids) and u.active = true")
	List<User> getUsersByEnrollmentClassIds(@Param("ids") List<Long> ids);

	@Query("select distinct new com.globits.security.dto.UserDto(u) "
			+ "from User u left join u.enrollmentClassIds ec "
			+ "where (cast(u.person.enrollmentClassId as long) in :ids or ec in :ids) and u.active = true")
	List<UserDto> getUsersDtoByEnrollmentClassIds(@Param("ids") List<Long> ids);

	@Query("select distinct u from User u left join u.enrollmentClassIds ec join u.roles r "
			+ "where r.name = 'ROLE_STUDENT' "
			+ "and (cast(u.person.enrollmentClassId as long) in :ids or ec in :ids) "
			+ "and u.active = true")
	List<User> getActiveStudentsByEnrollmentClassIds(@Param("ids") List<Long> ids);

    /*
     * Chỉ lọc theo group.
     */
    @Query(
        "select distinct "
        + "new com.globits.security.dto.UserDto(u) "
        + "from User u "
        + "join u.groups g "
        + "where g.id = :groupId "
        + "and u.active = true"
    )
    List<UserDto> getUsersDtoByGroupId(
            @Param("groupId") Long groupId
    );

    /*
     * Lọc đồng thời theo lớp và group.
     * Đây là phép giao: học sinh phải thuộc cả hai.
     */
    @Query(
        "select distinct "
        + "new com.globits.security.dto.UserDto(u) "
        + "from User u left join u.enrollmentClassIds ec "
        + "join u.groups g "
        + "where (u.person.enrollmentClassId = :enrollmentClassId or cast(ec as integer) = :enrollmentClassId) "
        + "and g.id = :groupId "
        + "and u.active = true"
    )
    List<UserDto> getUsersDtoByEnrollmentClassAndGroupId(
            @Param("enrollmentClassId")
            int enrollmentClassId,

            @Param("groupId")
            Long groupId
    );

	@Query("select distinct new com.globits.security.dto.UserDto(u) "
			+ "from User u left join u.enrollmentClassIds ec join u.groups g "
			+ "where (cast(u.person.enrollmentClassId as long) in :ids or ec in :ids) "
			+ "and g.id = :groupId and u.active = true")
	List<UserDto> getUsersDtoByEnrollmentClassIdsAndGroupId(
			@Param("ids") List<Long> ids,
			@Param("groupId") Long groupId);

    /*
     * Không chọn lớp và không chọn group.
     */
    @Query(
        "select new com.globits.security.dto.UserDto(u) "
        + "from User u "
        + "where u.active = true "
        + "and u.person is not null"
    )
    List<UserDto> getAllActiveStudentDtos();

    @Query("select distinct u from User u left join u.enrollmentClassIds ec "
            + "where (u.person.enrollmentClassId is not null or ec is not null) "
            + "and u.active = true")
    List<User> getUsersByAllEnrollmentClass();
}
