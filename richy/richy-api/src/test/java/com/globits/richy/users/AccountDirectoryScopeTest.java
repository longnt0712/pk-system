package com.globits.richy.users;

import com.globits.core.domain.Organization;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.dto.UserFilterDto;
import com.globits.security.service.impl.UserServiceImpl;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;

public class AccountDirectoryScopeTest {
    private void register(Configuration config, Class<?> sample) throws Exception {
        String pkg = sample.getPackage().getName();
        Path root = Paths.get(sample.getProtectionDomain().getCodeSource().getLocation().toURI());
        try (Stream<Path> files = Files.list(root.resolve(pkg.replace('.', '/')))) {
            for (Path file : files.collect(Collectors.toList())) {
                String name = file.getFileName().toString();
                if (!name.endsWith(".class") || name.contains("$")) { continue; }
                Class<?> entity = Class.forName(pkg + "." + name.substring(0, name.length() - 6));
                if (entity.isAnnotationPresent(Entity.class)) { config.addAnnotatedClass(entity); }
            }
        }
    }

    private void account(EntityManager em, String username, Role role, EnrolmentClass cls) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@example.invalid");
        user.setPassword("unused");
        user.setActive(true);
        user.setRoles(Collections.singleton(role));
        if (cls != null) { user.setEnrollmentClassIds(Collections.singleton(cls.getId())); }
        em.persist(user);
    }

    private Role role(EntityManager em, String name) {
        Role role = new Role(); role.setName(name); em.persist(role); return role;
    }

    private List<String> directory(UserServiceImpl service, int school, String type, boolean unassigned) {
        UserFilterDto filter = new UserFilterDto();
        filter.setSchoolId(school);
        filter.setDirectoryAccountType(type);
        filter.setWithoutEnrollmentClass(unassigned);
        org.springframework.data.domain.Page<UserDto> page = service.findAllPageable(filter, 1, 25);
        assertEquals(page.getContent().size(), page.getTotalElements());
        return page.getContent().stream().map(UserDto::getUsername).sorted().collect(Collectors.toList());
    }

    @Test public void studentAndStaffListsAreDisjointWithinEachSchool() throws Exception {
        org.h2.jdbcx.JdbcDataSource dataSource = new org.h2.jdbcx.JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:account_directory;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        Configuration config = new Configuration()
            .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop")
            .setProperty("hibernate.hbm2ddl.halt_on_error", "true");
        config.getProperties().put("hibernate.connection.datasource", dataSource);
        register(config, EnrolmentClass.class);
        register(config, Organization.class);
        register(config, User.class);
        try (SessionFactory factory = config.buildSessionFactory()) {
            EntityManager em = factory.createEntityManager();
            try {
                em.getTransaction().begin();
                EnrolmentClass ielts = new EnrolmentClass(); ielts.setSchoolId(1); em.persist(ielts);
                EnrolmentClass tntt = new EnrolmentClass(); tntt.setSchoolId(2); em.persist(tntt);
                Role viewer = role(em, "ROLE_VIEWER"), user = role(em, "ROLE_USER");
                Role student = role(em, "ROLE_STUDENT"), staff = role(em, "ROLE_STAFF");
                account(em, "ielts-viewer", viewer, ielts);
                account(em, "ielts-user", user, ielts);
                account(em, "ielts-unassigned", user, null);
                account(em, "tntt-student", student, tntt);
                account(em, "ielts-staff", staff, ielts);
                account(em, "tntt-staff", staff, tntt);
                em.flush();
                UserServiceImpl service = new UserServiceImpl();
                ReflectionTestUtils.setField(service, "manager", em);
                assertEquals(Arrays.asList("ielts-user", "ielts-viewer"), directory(service, 1, "STUDENT", false));
                assertEquals(Collections.singletonList("ielts-unassigned"), directory(service, 1, "STUDENT", true));
                assertEquals(Collections.singletonList("ielts-staff"), directory(service, 1, "STAFF", false));
                assertEquals(Collections.singletonList("tntt-student"), directory(service, 2, "STUDENT", false));
                assertEquals(Collections.singletonList("tntt-staff"), directory(service, 2, "STAFF", false));
            } finally {
                if (em.getTransaction().isActive()) { em.getTransaction().rollback(); }
                em.close();
            }
        }
    }
}
