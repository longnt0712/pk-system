package com.globits.security.rest;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.globits.core.dto.PersonDto;
import com.globits.core.utils.CommonUtils;
import com.globits.core.utils.ImageUtils;
import com.globits.core.utils.SecurityUtils;
import com.globits.security.domain.User;
import com.globits.security.dto.PasswordChangeDto;
import com.globits.security.dto.PhotoCropperDto;
import com.globits.security.dto.UserDto;
import com.globits.security.dto.UserFilterDto;
import com.globits.security.service.UserService;

@RestController
public class RestUserController {
	@Autowired
	private UserService userService;

	@PreAuthorize("isAuthenticated()")
	@GetMapping(path = "/api/users")
	public UserDto findByUsername(@RequestParam(value = "username", required = true) String username) {

		if (username == null) {
			return null;
		}

		return userService.findByUsername(username);
	}
	
	@PreAuthorize("isAuthenticated()")
	@GetMapping(path = "/api/users/get-all-user")
	public List<UserDto> getAllUserWithDisplayNameAndUsername() {
		return userService.getAllUserWithDisplayNameAndUsername();
	}

	@PreAuthorize("isAuthenticated()")
	@GetMapping(path = "/api/users/e/{email}")
	public ResponseEntity<UserDto> findByEmail(@PathVariable("email") String email) {

		if (CommonUtils.isEmpty(email)) {
			return new ResponseEntity<>(new UserDto(), HttpStatus.BAD_REQUEST);
		}

		return new ResponseEntity<>(userService.findByEmail(email), HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@GetMapping(value = "/api/users/{userId}")
	public UserDto getUser(@PathVariable("userId") String userId) {
		return userService.findByUserId(new Long(userId));
	}

	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@GetMapping(value = "/api/users/{pageIndex}/{pageSize}/{username}")
	public Page<UserDto> searchUsers(@PathVariable int pageIndex, @PathVariable int pageSize,
			@PathVariable String username) {
		return userService.searchByPageBasicInfo(pageIndex, pageSize, "%" + username + "%");
	}

	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@GetMapping(value = "/api/users/{pageIndex}/{pageSize}")
	public Page<UserDto> getUsers(@PathVariable int pageIndex, @PathVariable int pageSize) {
		return userService.findByPage(pageIndex, pageSize);
	}
	@PostMapping(path = "/api/users/search/{pageIndex}/{pageSize}")
	public ResponseEntity<Page<UserDto>> searchUsers(@RequestBody UserFilterDto filter,
			@PathVariable("pageIndex") int pageIndex, @PathVariable("pageSize") int pageSize) {
		if (filter == null) {
			return new ResponseEntity<Page<UserDto>>(
					new PageImpl(new ArrayList<>(), new PageRequest(pageIndex, pageSize), 0), HttpStatus.BAD_REQUEST);
		}
		return new ResponseEntity<>(userService.findAllPageable(filter, pageIndex, pageSize), HttpStatus.OK);
	}
	
	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@GetMapping(value = "/api/users/simple/{pageIndex}/{pageSize}")
	public Page<UserDto> findByPageBasicInfo(@PathVariable int pageIndex, @PathVariable int pageSize) {
		return userService.findByPageBasicInfo(pageIndex, pageSize);
	}

	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@PutMapping(path = "/api/users")
	public UserDto updateUser(@RequestBody UserDto user) {
		return userService.save(user);
	}

	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@PostMapping(path = "/api/users")
	public UserDto saveUser(@RequestBody UserDto user) {
		return userService.save(user);
	}

	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@DeleteMapping(value = "/api/users/{userId}")
	public UserDto removeUser(@PathVariable("userId") String userId) {
		return userService.deleteById(new Long(userId));
	}
	
	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@DeleteMapping(value = "/api/users")
	public ResponseEntity<UserDto> removeUser(@RequestBody UserDto dto) {
		if(dto!=null && dto.getId()!=null){
			Long userId = dto.getId();
			dto = userService.deleteById(new Long(userId));
			return new ResponseEntity<>(dto, HttpStatus.OK);
		}
		return new ResponseEntity<>(new UserDto(), HttpStatus.BAD_REQUEST);
	}
	
	// @Secured({ "ROLE_STUDENT", "ROLE_USER", "ROLE_ADMIN" })
	@PreAuthorize("isAuthenticated()")
	@GetMapping(value = "/api/users/getCurrentUser")
	public UserDto getCurrentUser() {
		UserDto user = userService.getCurrentUser();

		if (user != null) {
			user.setPassword(null);
		}

		return user;
	}

	@GetMapping(value = "/api/users/heartbeat")
	public void ping() {
		System.out.println("User session monitored...");
	}

	@GetMapping(value = "/public/users/photo/{username}")
	public void getProfilePhoto(HttpServletResponse response, @PathVariable("username") String username)
			throws ServletException, IOException {

		byte[] data = userService.getProfilePhoto(username);

		// CacheControl cc = CacheControl.maxAge(360, TimeUnit.DAYS).cachePublic();

		// response.setHeader("Cache-Control", cc.getHeaderValue());
		response.setContentType("image/jpg");
		

		try {
			if(data != null) {
				response.getOutputStream().write(data);	
			}
			response.flushBuffer();
			response.getOutputStream().close();
		} catch (Exception ex) {
			throw new RuntimeException(ex);
		}
	}

	@PreAuthorize("hasRole('ROLE_ADMIN')")
	@RequestMapping(path = "/api/users/password", method = RequestMethod.PUT)
	public ResponseEntity<UserDto> changePassword(@RequestBody UserDto user) {
		return new ResponseEntity<UserDto>(userService.changePassword(user), HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@RequestMapping(path = "/api/users/password/self", method = RequestMethod.PUT)
	public ResponseEntity<UserDto> changeMyPassword(@RequestBody UserDto dto) {

		User user = SecurityUtils.getCurrentUser();
		if (user == null) {
			return new ResponseEntity<UserDto>(new UserDto(), HttpStatus.FORBIDDEN);
		}

		if (!user.getUsername().equals(dto.getUsername())) {
			return new ResponseEntity<UserDto>(new UserDto(), HttpStatus.FORBIDDEN);
		}

		return new ResponseEntity<UserDto>(userService.changePassword(dto), HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@RequestMapping(path = "/api/users/password/valid", method = RequestMethod.POST)
	public ResponseEntity<Boolean> passwordValid(@RequestBody PasswordChangeDto dto) {
		if (dto == null) {
			return new ResponseEntity<Boolean>(false, HttpStatus.BAD_REQUEST);
		}

		User user = SecurityUtils.getCurrentUser();
		if (user == null) {
			return new ResponseEntity<Boolean>(false, HttpStatus.FORBIDDEN);
		}

		Boolean matched = SecurityUtils.passwordsMatch(user.getPassword(), dto.getPassword());

		return new ResponseEntity<Boolean>(matched, HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@PostMapping(path = "/api/users/photo/upload/{id}")
	public ResponseEntity<UserDto> uploadProfilePhoto(@RequestParam("file") MultipartFile file, @PathVariable("id") Long id) {

		User authen = SecurityUtils.getCurrentUser();
		if (authen == null) {
			return new ResponseEntity<UserDto>(new UserDto(), HttpStatus.FORBIDDEN);
		}
				
		UserDto userDto = new UserDto();
		PersonDto personDto = new PersonDto();

		if(id != null) {
			userDto.setId(id);
		}

		try {
			if (!file.isEmpty()) {
				byte[] data = file.getBytes();

				if (data != null && data.length > 0) {
					personDto.setPhoto(data);
					personDto.setPhotoCropped(false);

					userDto.setPerson(personDto);
					userDto = userService.savePhoto(userDto);
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}

		return new ResponseEntity<UserDto>(userDto, HttpStatus.OK);
	}
	
	@PreAuthorize("isAuthenticated()")
	@PostMapping(path = "/api/users/photo/upload")
	public ResponseEntity<UserDto> uploadProfilePhoto(@RequestParam("file") MultipartFile file) {

		User user = SecurityUtils.getCurrentUser();
		UserDto userDto = new UserDto();
		PersonDto personDto = new PersonDto();

		userDto.setId(user.getId());

		try {
			if (!file.isEmpty()) {
				byte[] data = file.getBytes();

				if (data != null && data.length > 0) {
					personDto.setPhoto(data);
					personDto.setPhotoCropped(false);

					userDto.setPerson(personDto);
					userDto = userService.savePhoto(userDto);
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}

		return new ResponseEntity<UserDto>(userDto, HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@RequestMapping(path = "/api/users/photo/crop", method = RequestMethod.POST)
	public ResponseEntity<UserDto> cropProfilePhoto(@RequestBody PhotoCropperDto dto) {

		User user = SecurityUtils.getCurrentUser();

		if (dto.getUser() == null || !user.getUsername().equals(dto.getUser().getUsername())) {
			return new ResponseEntity<UserDto>(new UserDto(), HttpStatus.FORBIDDEN);
		}

		byte[] userPhoto = userService.getProfilePhoto(dto.getUser().getUsername());

		if (userPhoto == null || userPhoto.length <= 0 || dto.getX() < 0 || dto.getY() < 0 || dto.getW() <= 0
				|| dto.getH() <= 0) {
			return new ResponseEntity<UserDto>(new UserDto(), HttpStatus.BAD_REQUEST);
		}

		userPhoto = ImageUtils.crop(userPhoto, dto.getX(), dto.getY(), dto.getW(), dto.getH());

		if (userPhoto == null) {
			return new ResponseEntity<UserDto>(new UserDto(), HttpStatus.BAD_REQUEST);
		}

		UserDto userDto = userService.findByUserId(user.getId());
		PersonDto personDto = userDto.getPerson();

		if (personDto == null) {
			return new ResponseEntity<UserDto>(userDto, HttpStatus.BAD_REQUEST);
		}

		try {
			personDto.setPhoto(userPhoto);
			personDto.setPhotoCropped(true);

			userDto = userService.savePhoto(userDto);
		} catch (Exception e) {
			e.printStackTrace();
		}

		return new ResponseEntity<UserDto>(userDto, HttpStatus.OK);
	}
	
	@PreAuthorize("isAuthenticated()")
	@RequestMapping(path = "/api/users/username/{username}/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	public ResponseEntity<Page<UserDto>> findByPageUsername(@PathVariable("username") String username, @PathVariable("pageIndex") int pageIndex, @PathVariable("pageSize") int pageSize) {
		return new ResponseEntity<Page<UserDto>>(userService.findByPageUsername(username, pageIndex, pageSize), HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@PostMapping(path = "/api/users/email_in_use")
	public ResponseEntity<Boolean> emailInUse(@RequestBody UserDto dto) {
		if (dto == null || CommonUtils.isEmpty(dto.getEmail())) {
			return new ResponseEntity<>(Boolean.TRUE, HttpStatus.BAD_REQUEST);
		}

		return new ResponseEntity<>(userService.emailAlreadyUsed(dto), HttpStatus.OK);
	}
	

}
