package com.globits.richy.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.globits.richy.domain.StudentMarkShare;
public interface StudentMarkShareRepository extends JpaRepository<StudentMarkShare,Long> {
    StudentMarkShare findByTokenHash(String tokenHash);
    List<StudentMarkShare> findTop50ByEnrollmentClassAndEducationProgramIdAndHostnameOrderByIdDesc(Integer classId,Long programId,String hostname);
}
