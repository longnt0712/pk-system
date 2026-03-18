package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.BillProduct;
import com.globits.richy.domain.BillShoesSize;
import com.globits.richy.domain.Product;
import com.globits.richy.dto.BillDto;
import com.globits.richy.dto.BillProductDto;
import com.globits.richy.dto.BillShoesSizeDto;
import com.globits.richy.dto.BillStatisticsDto;
import com.globits.richy.dto.ProductDto;
import com.globits.richy.repository.BillProductRepository;
import com.globits.richy.repository.BillRepository;
import com.globits.richy.repository.BillShoesSizeRepository;
import com.globits.richy.repository.ProductRepository;
import com.globits.richy.repository.ShoesSizesRepository;
import com.globits.richy.service.BillService;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

@Service
public class BillServiceImpl implements BillService {
	@Autowired
	EntityManager manager;
	@Autowired
	BillRepository billRepository;
	@Autowired
	BillShoesSizeRepository billShoesSizeRepository;
	@Autowired
	ProductRepository productRepository;
	@Autowired
	BillProductRepository billProductRepository;
	@Autowired
	UserRepository userRepository;

	@Override
	public Page<BillDto> getPageObject(BillDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.BillDto(s) from Bill s where (1=1) ";
		String sqlCount = "select count(s.id) from Bill s where (1=1)  ";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
		}
		
		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {	
			whereClause += " and (s.createDate >= :startDate and s.createDate < :endDate)";
		}
		
		if (searchDto != null && searchDto.getUser() != null && searchDto.getUser().getId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		
		sql += whereClause + " order by s.createDate DESC";	
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, BillDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {
			
			LocalDateTime startDate = searchDto.getStartDate();
			startDate = startDate.plusDays(1).withHourOfDay(0);
			LocalDateTime endDate = searchDto.getEndDate();
			endDate = endDate.plusDays(2).withHourOfDay(0);
			
			q.setParameter("startDate", startDate);
			qCount.setParameter("startDate", startDate);
			
			q.setParameter("endDate", endDate);
			qCount.setParameter("endDate", endDate);
		}
		
		if (searchDto != null && searchDto.getUser() != null && searchDto.getUser().getId() != null) {
			q.setParameter("username",  searchDto.getUser().getId());
			qCount.setParameter("username", searchDto.getUser().getId());
		}
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<BillDto> page = new PageImpl<BillDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<BillDto> getListObject(BillDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public BillDto getObjectById(Long id) {
		return new BillDto(billRepository.getOne(id));
	}

	/* (non-Javadoc)
	 * @see com.globits.richy.service.BillService#saveObject(com.globits.richy.dto.BillDto)
	 */
	@Override
	public boolean saveObject(BillDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return false;
		}
		Bill domain = null;
		
		if(dto.getId() != null) {
			domain = billRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Bill();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setDescription(dto.getDescription());
		domain.setTotalAmount(dto.getTotalAmount());
		domain.setPaymentMethod(dto.getPaymentMethod());
		

		//1: chưa giao: 2: đã giao
		if((domain.getStaffHasGivenMoney() != null && domain.getManagerHasTakenMoney() != null)
				&& domain.getStaffHasGivenMoney() == 2 && domain.getManagerHasTakenMoney() == 2) {
			//2 ông cùng không null, đã giao => không cho sửa nữa			
		}else if(domain.getStaffHasGivenMoney() == null || domain.getManagerHasTakenMoney() == null
				|| domain.getStaffHasGivenMoney() == 1 || domain.getManagerHasTakenMoney() == 1){ // 1 trong 2 null,chưa giao hoặc cả 2 cùng null,chưa giao thì vẫn cho sửa
			domain.setStaffHasGivenMoney(dto.getStaffHasGivenMoney());
			domain.setManagerHasTakenMoney(dto.getManagerHasTakenMoney());
		}
		
		if(dto.getUser() != null && dto.getUser().getId() != null) {
			User user = userRepository.getOne(dto.getUser().getId());
			if(user != null) {
				domain.setUser(user);
			}
		}
		
		if(dto.getVoided() == null) {
			domain.setVoided(false);
		} else {
			domain.setVoided(dto.getVoided());
		}
		
		if(dto.getBillProduct() !=null && dto.getBillProduct().size()>0) {
			HashSet<BillProduct> childrens = new HashSet<BillProduct>();
			for(BillProductDto q:dto.getBillProduct()) {
				BillProduct children = null;
				if(q.getId()!=null) {
					children= billProductRepository.getOne(q.getId());
				}
				if(children == null) {
					children = new BillProduct();
					children.setCreateDate(currentDate);
					children.setCreatedBy(currentUserName);
				}
				children.setBill(domain);
				
				//trong trường hợp hủy đơn thì những thằng này cũng phải bị voided
				if(dto.getVoided() == null) {
					children.setVoided(false);
				} else {
					children.setVoided(dto.getVoided());
				}
				
//				if(q.getBill() != null && q.getBill().getId() != null) {
//					children.setBill(billRepository.getOne(q.getBill().getId()));
//				}
				
				if(q.getProduct() != null && q.getProduct().getId() != null) {
					Product product = productRepository.getOne(q.getProduct().getId());
					
					if(product != null) {
						//trong trường hợp hủy đơn voided
						//cộng lại quantity vào 
						if(product.getQuantity() != null && q.getQuantity() != null && dto.getVoided() != null && dto.getVoided() == true) {
							int quantity = product.getQuantity() + q.getQuantity();
							product.setQuantity(quantity);
							productRepository.save(product);
						} else {
							if(product.getQuantity() != null && q.getQuantity() != null && q.getQuantity() <= product.getQuantity()) {
								int quantity = product.getQuantity() - q.getQuantity();
								product.setQuantity(quantity);
								productRepository.save(product);
							}
						}
					}
					
					children.setProduct(product);
				}
				children.setTotalAmount(q.getTotalAmount());
				children.setQuantity(q.getQuantity());
				childrens.add(children);
			}
			if(domain.getBillProduct()!=null) {
				domain.getBillProduct().clear();
				domain.getBillProduct().addAll(childrens);
			}else {
				domain.setBillProduct(childrens);
			}
		}else if(dto.getBillProduct()==null || dto.getBillProduct().size()<=0) {
			if(domain.getBillProduct() != null && domain.getBillProduct().size() > 0) {
				domain.getBillProduct().clear();
			}
		}

		domain = billRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Bill domain = billRepository.getOne(id);
		
		domain.setVoided(true);
		billRepository.save(domain);
		return true;
	}

	@Override
	public BillStatisticsDto getBillStatistics(BillDto searchDto) {
		
		//công tổng tiền trong khoảng thời gian
		String sql = "select sum(s.totalAmount) from Bill s where (1=1) and ( s.voided = false or s.voided is null) ";
		String sqlCredit = "select sum(s.totalAmount) from Bill s where (1=1) and ( s.voided = false or s.voided is null) and s.paymentMethod = 1 ";
		String sqlCash = "select sum(s.totalAmount) from Bill s where (1=1) and ( s.voided = false or s.voided is null) and s.paymentMethod = 2 ";
		
		//List tất cả bills ra
		String sqlListAllBills = "select "
				+ "new com.globits.richy.dto.BillProductDto(s.product, sum(s.quantity), sum(s.totalAmount)) "
				+ "from BillProduct s "
				+ "where (1=1) and ( s.voided = false or s.voided is null) ";		
		
		String whereClause = "";
		
		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {	
			whereClause += " and (s.createDate >= :startDate and s.createDate < :endDate)";
		}
		
		sql += whereClause;	
		sqlCredit += whereClause;	
		sqlCash += whereClause;	
		sqlListAllBills += whereClause + " group by s.product.id";

		Query q = manager.createQuery(sql, Double.class);
		Query qCredit = manager.createQuery(sqlCredit, Double.class);
		Query qCash = manager.createQuery(sqlCash, Double.class);

		Query qBill = manager.createQuery(sqlListAllBills, BillProductDto.class);

		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {
			
			LocalDateTime startDate = searchDto.getStartDate();
			startDate = startDate.plusDays(1).withHourOfDay(0);
			LocalDateTime endDate = searchDto.getEndDate();
			endDate = endDate.plusDays(2).withHourOfDay(0);
			q.setParameter("startDate", startDate);
			q.setParameter("endDate", endDate);
			
			qCredit.setParameter("startDate", startDate);
			qCredit.setParameter("endDate", endDate);
			
			qCash.setParameter("startDate", startDate);
			qCash.setParameter("endDate", endDate);
			
			qBill.setParameter("startDate", startDate);
			qBill.setParameter("endDate", endDate);
		}
		
		//công tổng tiền trong khoảng thời gian
		BillStatisticsDto ret = new BillStatisticsDto();
		Double totalQuantityOfBills = (Double) q.getSingleResult();
		Double totalQuantityOfBillsCredit = (Double) qCredit.getSingleResult();
		Double totalQuantityOfBillsCash = (Double) qCash.getSingleResult();


		if(totalQuantityOfBills != null) {
			ret.setTotalAmountOfBills(  totalQuantityOfBills);	
		}else {
			ret.setTotalAmountOfBills( (double) 0);
		}
		
		if(totalQuantityOfBillsCredit != null) {
			ret.setTotalAmountOfBillsCredit(  totalQuantityOfBillsCredit);	
		}else {
			ret.setTotalAmountOfBillsCredit( (double) 0);
		}
		
		if(totalQuantityOfBillsCash != null) {
			ret.setTotalAmountOfBillsCash(  totalQuantityOfBillsCash);	
		}else {
			ret.setTotalAmountOfBillsCash( (double) 0);
		}
		
		//List tất cả bills đang active ra
		List<BillProductDto> billProducts = qBill.getResultList();
		ret.setBillProductDtos(billProducts);
		
		return ret;
	}

}
