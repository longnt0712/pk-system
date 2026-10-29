package com.globits.richy.speaking;

import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingDto.*;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.service.impl.SpeakingServiceImpl;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.util.*;
import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Authorization rules for public admin banks and private student work. No production data. */
public class SpeakingSharedBankAccessTest {
    private SpeakingServiceImpl service;
    private EntityManager em;
    private User admin, secondAdmin, teacher, student, outside, unassigned;
    private SpeakingSet shared, privateSet;
    private final Map<Long,User> usersById = new LinkedHashMap<Long,User>();
    private final Map<Long,EnrolmentClass> classesById = new LinkedHashMap<Long,EnrolmentClass>();

    private User user(long id, String roleName) {
        User user = new User(); user.setId(id); user.setUsername("person" + id);
        if (roleName != null) { Role role = new Role(); role.setName(roleName); user.getRoles().add(role); }
        usersById.put(id,user); return user;
    }
    private void as(User actor) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor,"",Collections.emptyList()));
    }
    private void denied(Runnable action) { try { action.run(); fail("Expected access denied"); } catch (AccessDeniedException expected) {} }
    private SpeakingSet set(long id, long ownerId) {
        SpeakingSet set = new SpeakingSet(); set.setId(id); set.setOwnerId(ownerId); set.setSeasonYear(2026); set.setSetNumber(1);
        set.setClassIdsJson("[]"); set.setStudentIdsJson("[]"); return set;
    }
    @Before public void fixture() {
        service=new SpeakingServiceImpl(); em=mock(EntityManager.class);
        UserRepository users=mock(UserRepository.class); EnrolmentClassRepository classes=mock(EnrolmentClassRepository.class);
        ReflectionTestUtils.setField(service,"em",em);ReflectionTestUtils.setField(service,"users",users);ReflectionTestUtils.setField(service,"classes",classes);
        admin=user(1,"ROLE_ADMIN");secondAdmin=user(2,"ROLE_ADMIN");teacher=user(3,"ROLE_USER");student=user(4,null);outside=user(5,null);unassigned=user(6,"ROLE_USER");
        EnrolmentClass parent=new EnrolmentClass();parent.setId(10L);parent.getTeachers().add(teacher);
        EnrolmentClass child=new EnrolmentClass();child.setId(11L);child.setParent(parent);
        EnrolmentClass other=new EnrolmentClass();other.setId(12L);
        classesById.put(10L,parent);classesById.put(11L,child);classesById.put(12L,other);
        student.setEnrollmentClassIds(Collections.singleton(11L));outside.setEnrollmentClassIds(Collections.singleton(12L));
        when(users.findOne(anyLong())).thenAnswer(c->usersById.get(c.getArguments()[0]));
        when(users.findByUsernameAndPerson(anyString())).thenAnswer(c->usersById.values().stream().filter(u->u.getUsername().equals(c.getArguments()[0])).findFirst().orElse(null));
        when(users.getUsersByEnrollmentClassIds(anyList())).thenAnswer(c->{List<?> ids=(List<?>)c.getArguments()[0];List<User> found=new ArrayList<User>();for(User u:usersById.values())if(u.getEnrollmentClassIds()!=null&&u.getEnrollmentClassIds().stream().anyMatch(ids::contains))found.add(u);return found;});
        when(classes.findAll()).thenReturn(new ArrayList<EnrolmentClass>(classesById.values()));when(classes.findOne(anyLong())).thenAnswer(c->classesById.get(c.getArguments()[0]));
        shared=set(100,admin.getId());privateSet=set(101,teacher.getId());
        when(em.find(eq(SpeakingSet.class),anyLong())).thenAnswer(c->Long.valueOf(100).equals(c.getArguments()[1])?shared:privateSet);
        when(em.find(eq(SpeakingSet.class),anyLong(),any(LockModeType.class))).thenAnswer(c->Long.valueOf(100).equals(c.getArguments()[1])?shared:privateSet);
        as(teacher);
    }
    @After public void cleanup() { SecurityContextHolder.clearContext(); }
    @Test public void oldAdminBankIsReadableWithoutAnyShareAndKeepsItsOwner() {
        assertTrue(service.canRead(shared,student));assertTrue(service.canRead(shared,outside));assertTrue(service.canRead(shared,secondAdmin));
        assertEquals(Long.valueOf(1),shared.getOwnerId());assertEquals("[]",shared.getStudentIdsJson());
        assertFalse(service.canRead(null,student));assertFalse(service.canRead(shared,null));
    }
    @Test public void privateTeacherBankStillRequiresSharing() {
        assertFalse(service.canRead(privateSet,student));assertFalse(service.canRead(privateSet,secondAdmin));
        privateSet.setClassIdsJson("[10]");assertTrue(service.canRead(privateSet,student));assertFalse(service.canRead(privateSet,outside));
    }
    @Test public void teachersReviewTheirStudentsThroughParentClassesOnly() {
        assertTrue(service.canReviewStudents(shared,teacher));assertSame(student,service.reviewableStudent(shared,student.getId()));
        denied(()->service.reviewableStudent(shared,outside.getId()));as(unassigned);assertFalse(service.canReviewStudents(shared,unassigned));
        denied(()->service.reviewableStudent(shared,student.getId()));
    }
    @Test public void studentCanEditOwnAnswerButCannotReadOtherAnswersOrMarkPass() {
        as(student);assertSame(student,service.reviewableStudent(shared,null));assertSame(student,service.reviewableStudent(shared,student.getId()));
        denied(()->service.reviewableStudent(shared,outside.getId()));
        PassRequest request=new PassRequest();request.studentId=student.getId();request.passed=true;request.questionIds=Collections.singletonList(200L);
        denied(()->service.markPass(shared.getId(),request));
    }
    @Test public void globalStudentPickerRejectsExactUsernameOutsideTheTeachersClasses() {
        assertTrue(service.students(shared.getId(),outside.getUsername()).isEmpty());
        List<Map<String,Object>> found=service.students(shared.getId(),student.getUsername());assertEquals(1,found.size());assertEquals(student.getId(),found.get(0).get("id"));
        as(student);denied(()->service.students(shared.getId(),""));
    }
    @Test public void aSecondAdminCanReviewGlobalStudentsButCannotReplaceBankContent() {
        as(secondAdmin);assertSame(outside,service.reviewableStudent(shared,outside.getId()));
        denied(()->service.exportSet(shared.getId()));denied(()->service.share(shared.getId(),new SetRequest()));
    }
    @Test public void aPublicBankDoesNotMakeOtherStudentsPracticeOrAudioPublic() {
        SpeakingPractice practice=new SpeakingPractice();practice.setId(300L);practice.setStudentId(student.getId());practice.setBankOwnerId(admin.getId());
        when(em.find(eq(SpeakingPractice.class),eq(300L),any(LockModeType.class))).thenReturn(practice);
        assertTrue(service.canRead(shared,teacher));denied(()->service.accessiblePractice(300L,false));as(secondAdmin);denied(()->service.accessiblePractice(300L,false));
        as(student);assertSame(practice,service.accessiblePractice(300L,false));
    }
    @Test public void missingOwnerIsNotPublicAndPrivateOwnerStillRequiresStudentAccess() {
        shared.setOwnerId(999L);assertFalse(service.canRead(shared,outside));
        as(teacher);denied(()->service.reviewableStudent(privateSet,student.getId()));privateSet.setStudentIdsJson("[4]");assertSame(student,service.reviewableStudent(privateSet,student.getId()));
    }
    @Test public void importsAreAdminOnlyEvenForThePrivateTeacherBankOwner()throws Exception {
        for(User actor:Arrays.asList(teacher,student,unassigned)) {
            as(actor);denied(()->service.requireAdmin());
            try{service.preview(privateSet.getId(),new byte[]{1});fail();}catch(AccessDeniedException expected){}
            denied(()->service.confirm(privateSet.getId(),new ConfirmImport()));
        }
        as(admin);assertSame(admin,service.requireAdmin());
        as(teacher);assertSame(student,service.reviewableStudent(shared,student.getId()));
    }
}
