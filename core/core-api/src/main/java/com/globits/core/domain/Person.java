package com.globits.core.domain;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.Basic;
import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.DiscriminatorColumn;
import javax.persistence.DiscriminatorType;
import javax.persistence.DiscriminatorValue;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.Inheritance;
import javax.persistence.InheritanceType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.OneToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Type;

import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_person")
@Inheritance(strategy = InheritanceType.JOINED)
//@DiscriminatorColumn(name = "TYPE", discriminatorType = DiscriminatorType.INTEGER)
@XmlRootElement
public class Person extends BaseObject {

	private static final long serialVersionUID = 1216825583672377485L;

	// @Id
	// @GeneratedValue(strategy = GenerationType.IDENTITY)
	// private Long id;

	@Column(name = "patron", nullable = true)
	protected String patron; //thánh bảo trợ
	
	@Column(name = "sacrament", nullable = true)
	protected String sacrament; //đã lãnh tới bí tích
	
	@Column(name = "first_name", nullable = true)
	protected String firstName;

	@Column(name = "last_name", nullable = true)
	protected String lastName;

	@Column(name = "display_name", nullable = true)
	protected String displayName;
	@Column(name = "short_name", nullable = true)
	protected String shortName;//Ví dụ : Ô. Ổn, ô Đăng, Ô Kim, .... dùng trong lịch tuần
	
	@Column(name = "birth_date", nullable = true)
	protected Date birthDate;

	@Column(name = "birth_place", nullable = true)
	protected String birthPlace;

	@Column(name = "gender", nullable = true)
	protected String gender;

	@Column(name = "start_date", nullable = true)
	protected Date startDate;

	@Column(name = "end_date", nullable = true)
	protected Date endDate;

	@Column(name = "phone_number", nullable = true)
	protected String phoneNumber;

	@Column(name = "id_number", nullable = true)
	protected String idNumber;// Số chứng mình thư

	@Column(name = "id_number_issue_by", nullable = true)
	protected String idNumberIssueBy;

	@Column(name = "id_number_issue_date", nullable = true)
	protected Date idNumberIssueDate;

	@Column(name = "email", nullable = true)
	protected String Email;

	@Column(name = "communist_youth_union_join_date", nullable = true)
	protected Date communistYouthUnionJoinDate;//Ngày vào đoàn
	
	@Column(name = "communist_party_join_date", nullable = true)
	protected Date communistPartyJoinDate;//Ngày vào đảng
	
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "country_id", nullable = true)
	protected Country nationality;

	@ManyToOne
	@JoinColumn(name = "native_village", nullable = true)
	protected AdministrativeUnit nativeVillage;// Quê quán (có thể lựa chọn Home Town???)

	@ManyToOne(fetch = FetchType.EAGER, cascade = CascadeType.REFRESH)
	@JoinColumn(name = "ethnics_id", nullable = true)
	protected Ethnics ethnics;

	@ManyToOne(fetch = FetchType.EAGER, cascade = CascadeType.REFRESH)
	@JoinColumn(name = "religion_id", nullable = true)
	protected Religion religion;

	@OneToMany(mappedBy = "person", fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
	protected Set<PersonAddress> address;//Sử dụng trong địa chỉ thường trú và nơi ở hiện tại
	
	@Column(name = "carrer", nullable = true)
	protected String carrer;//nghề nghiệp/chức vụ

	//@OneToOne(cascade = CascadeType.ALL, optional = true, fetch = FetchType.LAZY)
	@ManyToOne(cascade = CascadeType.ALL, optional = true, fetch = FetchType.LAZY)
	//@OneToOne
	@JoinColumn(name = "user_id", unique = false)
	protected User user;

	@Basic(fetch = FetchType.LAZY)
	//@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
	@Column(name = "photo", nullable = true,length=5242880)//Kích thước tối đa 5M, có thể để kích thước lớn hơn
	protected byte[] photo;

	@Column(name = "photo_cropped", nullable = true)
	private Boolean photoCropped;
	
	@ManyToOne(cascade = CascadeType.PERSIST, optional = true, fetch = FetchType.LAZY)
	@JoinColumn(name = "family_social_class_id", unique = false)
	private SocialClass familySocialClass;//Thành phần gia đình

	@ManyToOne(cascade = CascadeType.PERSIST, optional = true, fetch = FetchType.LAZY)
	//@OneToOne
	@JoinColumn(name = "personal_social_priority_id", unique = false)
	private SocialPriority personalSocialPriority;//Diện ưu tiên bản thân
	
	@ManyToOne(cascade = CascadeType.PERSIST, optional = true, fetch = FetchType.LAZY)
	//@OneToOne
	@JoinColumn(name = "family_social_priority_id", unique = false)
	private SocialPriority familySocialPriority;//Diện ưu tiên gia đình
	
	@Column(name = "marital_status", nullable = true)
	private Integer maritalStatus;//Tình trạng hôn nhân
	
	@Column(name = "is_dead", nullable = true)
	private Boolean isDead;
	
	@Column(name = "address")
	private String addressString;
	
	@Column(name = "diocese")
	private String diocese;
	
	@Column(name = "father_full_name")
	private String fatherFullName; // Họ tên bố
	
	@Column(name = "father_phone_number")
	private String fatherPhoneNumber; 

	@Column(name = "mother_full_name")
	private String motherFullName; // Họ tên mẹ
	
	@Column(name = "mother_phone_number")
	private String motherPhoneNumber; 
	
	@Column(name = "class_id")
	private Integer enrollmentClass; // Lớp nhập học
	
	@Column(name = "zalo_status")
	private Integer zaloStatus;
	
	public String getDiocese() {
		return diocese;
	}

	public void setDiocese(String diocese) {
		this.diocese = diocese;
	}

	public String getAddressString() {
		return addressString;
	}

	public void setAddressString(String addressString) {
		this.addressString = addressString;
	}

	public String getFatherFullName() {
		return fatherFullName;
	}

	public void setFatherFullName(String fatherFullName) {
		this.fatherFullName = fatherFullName;
	}

	public String getFatherPhoneNumber() {
		return fatherPhoneNumber;
	}

	public void setFatherPhoneNumber(String fatherPhoneNumber) {
		this.fatherPhoneNumber = fatherPhoneNumber;
	}

	public String getMotherFullName() {
		return motherFullName;
	}

	public void setMotherFullName(String motherFullName) {
		this.motherFullName = motherFullName;
	}

	public String getMotherPhoneNumber() {
		return motherPhoneNumber;
	}

	public void setMotherPhoneNumber(String motherPhoneNumber) {
		this.motherPhoneNumber = motherPhoneNumber;
	}

	public Integer getEnrollmentClass() {
		return enrollmentClass;
	}

	public void setEnrollmentClass(Integer enrollmentClass) {
		this.enrollmentClass = enrollmentClass;
	}

	public Integer getZaloStatus() {
		return zaloStatus;
	}

	public void setZaloStatus(Integer zaloStatus) {
		this.zaloStatus = zaloStatus;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getDisplayName() {
		return displayName;
	}
	
	

	public String getPatron() {
		return patron;
	}

	public void setPatron(String patron) {
		this.patron = patron;
	}

	public String getSacrament() {
		return sacrament;
	}

	public void setSacrament(String sacrament) {
		this.sacrament = sacrament;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getShortName() {
		return shortName;
	}

	public void setShortName(String shortName) {
		this.shortName = shortName;
	}

	public Date getBirthDate() {
		return birthDate;
	}

	public void setBirthDate(Date birthDate) {
		this.birthDate = birthDate;
	}

	public String getBirthPlace() {
		return birthPlace;
	}

	public void setBirthPlace(String birthPlace) {
		this.birthPlace = birthPlace;
	}

	public String getGender() {
		return gender;
	}

	public void setGender(String gender) {
		this.gender = gender;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public byte[] getPhoto() {
		return photo;
	}

	public void setPhoto(byte[] photo) {
		this.photo = photo;
	}

	public Boolean getPhotoCropped() {
		return photoCropped;
	}

	public void setPhotoCropped(Boolean photoCropped) {
		this.photoCropped = photoCropped;
	}

	public Set<PersonAddress> getAddress() {
		return address;
	}

	public void setAddress(Set<PersonAddress> address) {
		this.address = address;
	}


	public SocialClass getFamilySocialClass() {
		return familySocialClass;
	}

	public void setFamilySocialClass(SocialClass familySocialClass) {
		this.familySocialClass = familySocialClass;
	}

	public SocialPriority getPersonalSocialPriority() {
		return personalSocialPriority;
	}

	public void setPersonalSocialPriority(SocialPriority personalSocialPriority) {
		this.personalSocialPriority = personalSocialPriority;
	}

	public SocialPriority getFamilySocialPriority() {
		return familySocialPriority;
	}

	public void setFamilySocialPriority(SocialPriority familySocialPriority) {
		this.familySocialPriority = familySocialPriority;
	}

	public Integer getMaritalStatus() {
		return maritalStatus;
	}

	public void setMaritalStatus(Integer maritalStatus) {
		this.maritalStatus = maritalStatus;
	}

	public Date getStartDate() {
		return startDate;
	}

	public void setStartDate(Date startDate) {
		this.startDate = startDate;
	}

	public Date getEndDate() {
		return endDate;
	}

	public void setEndDate(Date endDate) {
		this.endDate = endDate;
	}

	public Ethnics getEthnics() {
		return ethnics;
	}

	public void setEthnics(Ethnics ethnics) {
		this.ethnics = ethnics;
	}

	public Religion getReligion() {
		return religion;
	}

	public void setReligion(Religion religion) {
		this.religion = religion;
	}

	public String getPhoneNumber() {
		return phoneNumber;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public Country getNationality() {
		return nationality;
	}

	public void setNationality(Country nationality) {
		this.nationality = nationality;
	}

	public String getIdNumber() {
		return idNumber;
	}

	public void setIdNumber(String idNumber) {
		this.idNumber = idNumber;
	}

	public String getIdNumberIssueBy() {
		return idNumberIssueBy;
	}

	public void setIdNumberIssueBy(String idNumberIssueBy) {
		this.idNumberIssueBy = idNumberIssueBy;
	}

	public Date getIdNumberIssueDate() {
		return idNumberIssueDate;
	}

	public void setIdNumberIssueDate(Date idNumberIssueDate) {
		this.idNumberIssueDate = idNumberIssueDate;
	}

	public String getEmail() {
		return Email;
	}

	public void setEmail(String email) {
		Email = email;
	}

	public AdministrativeUnit getNativeVillage() {
		return nativeVillage;
	}

	public void setNativeVillage(AdministrativeUnit nativeVillage) {
		this.nativeVillage = nativeVillage;
	}
	
	public String getCarrer() {
		return carrer;
	}

	public void setCarrer(String carrer) {
		this.carrer = carrer;
	}

	public Date getCommunistYouthUnionJoinDate() {
		return communistYouthUnionJoinDate;
	}

	public void setCommunistYouthUnionJoinDate(Date communistYouthUnionJoinDate) {
		this.communistYouthUnionJoinDate = communistYouthUnionJoinDate;
	}

	public Date getCommunistPartyJoinDate() {
		return communistPartyJoinDate;
	}

	public void setCommunistPartyJoinDate(Date communistPartyJoinDate) {
		this.communistPartyJoinDate = communistPartyJoinDate;
	}

	public Boolean getIsDead() {
		return isDead;
	}

	public void setIsDead(Boolean isDead) {
		this.isDead = isDead;
	}

	public Person() {

	}

	public Person(Long id, String firstName, String lastName, String displayName, Date birtDate, String phoneNumber) {
		this.setId(id);
		this.setFirstName(firstName);
		this.setLastName(lastName);
		this.setDisplayName(displayName);
		this.setBirthDate(birtDate);
	}

	public Person(Person person) {
		super(person);
		this.firstName = person.getFirstName();
		this.lastName = person.getLastName();
		this.displayName = person.getDisplayName();
		
		if (person.getAddress() != null) {
			Set<PersonAddress> address = new HashSet<PersonAddress>();
			for (PersonAddress tt : person.getAddress() ) {
				PersonAddress ttDto = new PersonAddress();
				ttDto=tt;
				address.add(ttDto);
			}
			this.address=address;
		}
		this.birthDate = person.getBirthDate();
		this.birthPlace = person.getBirthPlace();
		this.Email = person.getEmail();
		this.photo = person.getPhoto();
		this.photoCropped = person.getPhotoCropped();
		this.nationality = person.getNationality();
		this.nativeVillage = person.getNativeVillage();
		this.ethnics = person.getEthnics();
		this.gender = person.getGender();
		this.idNumber = person.getIdNumber();
		this.idNumberIssueDate = person.getIdNumberIssueDate();
		this.phoneNumber = person.getPhoneNumber();
		this.idNumberIssueBy = person.getIdNumberIssueBy();
		this.religion = person.getReligion();
		if (person.getUser() != null) {
			this.user = new User(person.getUser(), false);
		}
		this.carrer=person.getCarrer();
	}
}
