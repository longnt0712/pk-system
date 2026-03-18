package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.ArticleDto;
import com.globits.richy.dto.ListArticleForCategoryDto;

public interface ArticleService {
	public Page<ArticleDto> getPageObject(ArticleDto searchDto, int pageIndex, int pageSize);
	public Page<ArticleDto> getTheLatest(ArticleDto searchDto, int pageIndex, int pageSize);
	public Page<ArticleDto> getMassSchedule(ArticleDto searchDto, int pageIndex, int pageSize);
	public Page<ArticleDto> getBibleCalendar(ArticleDto searchDto, int pageIndex, int pageSize);
	
	public ListArticleForCategoryDto getPageObjectSideCategory(ArticleDto searchDto, int pageIndex, int pageSize);
	public List<ArticleDto> getListObject(ArticleDto searchDto, int pageIndex, int pageSize);
	public ArticleDto getObjectById(Long id);
	public boolean saveObject(ArticleDto dto);
	public boolean saveViews(ArticleDto dto);
	public boolean deleteObject(Long id);
}
